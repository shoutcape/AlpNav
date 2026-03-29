import type { GeoPoint, MappedRoute, MappedSegment, Point } from "@/lib/domain/types";

export type ProjectionResult = {
  point: Point;
  distance: number; // meters from GPS to nearest route
  routeNumber: string;
  segmentId: string;
};

const MAX_SNAP_DISTANCE = 50; // meters

/**
 * Projects real-world GPS coordinates onto panorama pixel coordinates
 * by snapping to the nearest matched route segment and interpolating.
 */
export class GpsToPanoramaMapper {
  private segments: { seg: MappedSegment; routeNumber: string }[] = [];
  readonly routes: MappedRoute[];

  constructor(routes: MappedRoute[]) {
    this.routes = routes;
    for (const route of routes) {
      for (const seg of route.segments) {
        this.segments.push({ seg, routeNumber: route.number });
      }
    }
  }

  get segmentCount(): number {
    return this.segments.length;
  }

  /** Project a GPS position to panorama pixel coordinates */
  project(geo: GeoPoint): ProjectionResult | null {
    let bestResult: {
      segment: { seg: MappedSegment; routeNumber: string };
      distance: number;
      geoParam: number; // cumulative distance along geo path at closest point
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

    // Map geo cumulative distance → SVG cumulative distance
    const geoTotal = seg.geoCumulDist[seg.geoCumulDist.length - 1];
    const svgTotal = seg.svgCumulDist[seg.svgCumulDist.length - 1];

    if (geoTotal === 0 || svgTotal === 0) return null;

    // Normalized parameter along the route
    const t = geoParam / geoTotal;
    const svgDist = t * svgTotal;

    // Interpolate along SVG polyline at svgDist
    const point = interpolateAtDistance(seg.svgPoints, seg.svgCumulDist, svgDist);

    return { point, distance, routeNumber: segment.routeNumber, segmentId: seg.id };
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
