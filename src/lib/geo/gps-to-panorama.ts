import type { AnchorPoint, GeoPoint, MappedRoute, MappedSegment, Point } from "@/lib/domain/types";

export type ProjectionResult = {
  point: Point;
  distance: number; // meters from GPS to nearest match
  routeNumber: string;
  segmentId: string;
  anchorName?: string; // set when snapped to an anchor point
};

const MAX_SNAP_DISTANCE = 50; // meters

/**
 * Projects real-world GPS coordinates onto panorama pixel coordinates
 * by snapping to the nearest matched route segment and interpolating.
 */
export class GpsToPanoramaMapper {
  private segments: { seg: MappedSegment; routeNumber: string }[] = [];
  private anchors: AnchorPoint[];
  readonly routes: MappedRoute[];

  constructor(routes: MappedRoute[], anchors: AnchorPoint[] = []) {
    this.routes = routes;
    this.anchors = anchors;
    for (const route of routes) {
      for (const seg of route.segments) {
        this.segments.push({ seg, routeNumber: route.number });
      }
    }
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  get anchorCount(): number {
    return this.anchors.length;
  }

  /** Project a GPS position to panorama pixel coordinates */
  project(geo: GeoPoint): ProjectionResult | null {
    // Priority 1: check anchor points (lift stations, restaurants)
    const anchorResult = this.snapToAnchor(geo);
    if (anchorResult) return anchorResult;

    // Priority 2: route-based interpolation
    let bestResult: {
      segment: { seg: MappedSegment; routeNumber: string };
      distance: number;
      geoParam: number;
    } | null = null;

    for (const entry of this.segments) {
      const snap = snapToPolyline(geo, entry.seg.geoPoints, entry.seg.geoCumulDist);
      if (snap && (!bestResult || snap.distance < bestResult.distance)) {
        bestResult = { segment: entry, distance: snap.distance, geoParam: snap.cumulDist };
      }
    }

    if (!bestResult || bestResult.distance > MAX_SNAP_DISTANCE) return null;

    const { segment, distance, geoParam } = bestResult;
    const seg = segment.seg;

    const geoTotal = seg.geoCumulDist[seg.geoCumulDist.length - 1];
    const svgTotal = seg.svgCumulDist[seg.svgCumulDist.length - 1];

    if (geoTotal === 0 || svgTotal === 0) return null;

    const t = geoParam / geoTotal;
    const svgDist = t * svgTotal;
    const point = interpolateAtDistance(seg.svgPoints, seg.svgCumulDist, svgDist);

    return { point, distance, routeNumber: segment.routeNumber, segmentId: seg.id };
  }

  /** Check if GPS is within snap radius of any anchor point */
  private snapToAnchor(geo: GeoPoint): ProjectionResult | null {
    let bestAnchor: AnchorPoint | null = null;
    let bestDist = Infinity;

    for (const anchor of this.anchors) {
      const dist = haversine(geo, anchor.geo);
      if (dist <= anchor.snapRadius && dist < bestDist) {
        bestDist = dist;
        bestAnchor = anchor;
      }
    }

    if (!bestAnchor) return null;

    return {
      point: bestAnchor.panorama,
      distance: bestDist,
      routeNumber: "",
      segmentId: bestAnchor.id,
      anchorName: bestAnchor.name,
    };
  }

  /** Reverse project: find estimated GPS coords for a panorama point */
  reverseProject(px: number, py: number): { geo: GeoPoint; source: string } | null {
    // Check anchors first (nearest by panorama distance)
    let bestAnchorDist = Infinity;
    let bestAnchor: AnchorPoint | null = null;
    for (const anchor of this.anchors) {
      const d = Math.hypot(px - anchor.panorama.x, py - anchor.panorama.y);
      if (d < bestAnchorDist) {
        bestAnchorDist = d;
        bestAnchor = anchor;
      }
    }

    // Check route segments (nearest point on SVG polyline → map to geo)
    let bestSegDist = Infinity;
    let bestGeo: GeoPoint | null = null;
    let bestSource = "";

    for (const entry of this.segments) {
      const seg = entry.seg;
      const svgTotal = seg.svgCumulDist[seg.svgCumulDist.length - 1];
      const geoTotal = seg.geoCumulDist[seg.geoCumulDist.length - 1];
      if (svgTotal === 0 || geoTotal === 0) continue;

      // Find closest point on SVG polyline
      for (let i = 0; i < seg.svgPoints.length - 1; i++) {
        const a = seg.svgPoints[i];
        const b = seg.svgPoints[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        const d = Math.hypot(px - projX, py - projY);

        if (d < bestSegDist) {
          bestSegDist = d;
          // Map SVG position back to geo
          const segLen = seg.svgCumulDist[i + 1] - seg.svgCumulDist[i];
          const svgDist = seg.svgCumulDist[i] + t * segLen;
          const tGeo = svgDist / svgTotal;
          const geoDist = tGeo * geoTotal;
          bestGeo = interpolateGeoAtDistance(seg.geoPoints, seg.geoCumulDist, geoDist);
          bestSource = `route ${entry.routeNumber}`;
        }
      }
    }

    // Anchors take priority within a generous radius (lifts/restaurants are ground truth)
    if (bestAnchor && bestAnchorDist < 80) {
      return { geo: bestAnchor.geo, source: bestAnchor.name };
    }

    if (bestGeo) {
      return { geo: bestGeo, source: bestSource };
    }

    return null;
  }
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

type SnapResult = { distance: number; cumulDist: number };

/** Find the closest point on a geo-polyline to a GPS position */
function snapToPolyline(
  p: GeoPoint,
  line: GeoPoint[],
  cumulDist: number[],
): SnapResult | null {
  if (line.length < 2) return null;

  let bestDist = Infinity;
  let bestCumul = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segLen = cumulDist[i + 1] - cumulDist[i];
    if (segLen === 0) continue;

    // Project p onto segment a-b using flat approximation (good enough at ski-resort scale)
    const t = projectOntoSegment(p, a, b);
    const clampedT = Math.max(0, Math.min(1, t));

    const projected: GeoPoint = {
      lat: a.lat + clampedT * (b.lat - a.lat),
      lng: a.lng + clampedT * (b.lng - a.lng),
    };

    const dist = haversine(p, projected);
    if (dist < bestDist) {
      bestDist = dist;
      bestCumul = cumulDist[i] + clampedT * segLen;
    }
  }

  return { distance: bestDist, cumulDist: bestCumul };
}

/** Project point p onto line segment a-b, returning parameter t (0 = a, 1 = b) */
function projectOntoSegment(p: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  // Use flat approximation with cos(lat) correction for longitude
  const cosLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dx = (b.lng - a.lng) * cosLat;
  const dy = b.lat - a.lat;
  const px = (p.lng - a.lng) * cosLat;
  const py = p.lat - a.lat;
  const dot = px * dx + py * dy;
  const lenSq = dx * dx + dy * dy;
  return lenSq === 0 ? 0 : dot / lenSq;
}

/** Haversine distance in meters */
function haversine(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aLat = (a.lat * Math.PI) / 180;
  const bLat = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Interpolate a point along a 2D polyline at a given cumulative distance */
function interpolateAtDistance(points: Point[], cumulDist: number[], targetDist: number): Point {
  // Clamp to path bounds
  const totalLen = cumulDist[cumulDist.length - 1];
  const d = Math.max(0, Math.min(totalLen, targetDist));

  // Find the segment containing this distance
  for (let i = 0; i < points.length - 1; i++) {
    if (d >= cumulDist[i] && d <= cumulDist[i + 1]) {
      const segLen = cumulDist[i + 1] - cumulDist[i];
      const t = segLen === 0 ? 0 : (d - cumulDist[i]) / segLen;
      return {
        x: points[i].x + t * (points[i + 1].x - points[i].x),
        y: points[i].y + t * (points[i + 1].y - points[i].y),
      };
    }
  }

  // Fallback: return last point
  return points[points.length - 1];
}

/** Interpolate a point along a geo polyline at a given cumulative distance */
function interpolateGeoAtDistance(points: GeoPoint[], cumulDist: number[], targetDist: number): GeoPoint {
  const totalLen = cumulDist[cumulDist.length - 1];
  const d = Math.max(0, Math.min(totalLen, targetDist));

  for (let i = 0; i < points.length - 1; i++) {
    if (d >= cumulDist[i] && d <= cumulDist[i + 1]) {
      const segLen = cumulDist[i + 1] - cumulDist[i];
      const t = segLen === 0 ? 0 : (d - cumulDist[i]) / segLen;
      return {
        lat: points[i].lat + t * (points[i + 1].lat - points[i].lat),
        lng: points[i].lng + t * (points[i + 1].lng - points[i].lng),
      };
    }
  }

  return points[points.length - 1];
}
