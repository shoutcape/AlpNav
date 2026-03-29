import type { GeoPoint, MappedRoute, MappedSegment, Piste, Point } from "@/lib/domain/types";
import type { OsmPiste } from "./osm-types";
import { getOsmRouteNumber } from "./osm-types";

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Match OSM pistes to SVG pistes by route number, then align individual
 * segments using length-ratio and bearing heuristics.
 *
 * Returns one MappedRoute per successfully matched piste.
 */
export function matchRoutes(pistes: Piste[], osmPistes: OsmPiste[]): MappedRoute[] {
  // Group OSM ways by route number
  const osmByNumber = groupOsmByNumber(osmPistes);
  const results: MappedRoute[] = [];

  for (const piste of pistes) {
    if (!piste.number) continue;
    const osmWays = osmByNumber.get(piste.number);
    if (!osmWays || osmWays.length === 0) continue;

    // Collect all SVG segments: main segments + variant segments
    const svgSegments = collectSvgSegments(piste);
    // Collect all OSM geo-polylines (flatten relations into individual ways)
    const geoSegments = collectGeoSegments(osmWays);

    if (svgSegments.length === 0 || geoSegments.length === 0) continue;

    // Match segments using automated heuristics
    const matched = matchSegments(piste.id, svgSegments, geoSegments);
    if (matched.length > 0) {
      results.push({ pisteId: piste.id, number: piste.number, segments: matched });
    }
  }

  return results;
}

// ─── OSM grouping ────────────────────────────────────────────────────────────

function groupOsmByNumber(osmPistes: OsmPiste[]): Map<string, OsmPiste[]> {
  const map = new Map<string, OsmPiste[]>();
  for (const p of osmPistes) {
    const num = getOsmRouteNumber(p);
    if (!num) continue;
    if (!map.has(num)) map.set(num, []);
    map.get(num)!.push(p);
  }
  return map;
}

// ─── SVG segment collection ─────────────────────────────────────────────────

type LabeledSegment<T> = { label: string; points: T[] };

function collectSvgSegments(piste: Piste): LabeledSegment<Point>[] {
  const result: LabeledSegment<Point>[] = [];

  for (let i = 0; i < piste.segments.length; i++) {
    if (piste.segments[i].length >= 2) {
      result.push({ label: `main_${i}`, points: piste.segments[i] });
    }
  }

  if (piste.variants) {
    for (const v of piste.variants) {
      for (let i = 0; i < v.segments.length; i++) {
        if (v.segments[i].length >= 2) {
          result.push({ label: `${v.variantId}_${i}`, points: v.segments[i] });
        }
      }
    }
  }

  return result;
}

// ─── Geo segment collection ─────────────────────────────────────────────────

function collectGeoSegments(osmPistes: OsmPiste[]): LabeledSegment<GeoPoint>[] {
  const result: LabeledSegment<GeoPoint>[] = [];

  for (const p of osmPistes) {
    if (p.type === "way") {
      if (p.geoPoints.length >= 2) {
        result.push({ label: p.osmId, points: p.geoPoints });
      }
    } else {
      for (let i = 0; i < p.ways.length; i++) {
        if (p.ways[i].geoPoints.length >= 2) {
          result.push({ label: `${p.osmId}_w${i}`, points: p.ways[i].geoPoints });
        }
      }
    }
  }

  return result;
}

// ─── Segment matching ────────────────────────────────────────────────────────

function matchSegments(
  pisteId: string,
  svgSegs: LabeledSegment<Point>[],
  geoSegs: LabeledSegment<GeoPoint>[],
): MappedSegment[] {
  if (svgSegs.length === 0 || geoSegs.length === 0) return [];

  // Compute lengths and bearings for all segments
  const svgInfos = svgSegs.map((s) => ({
    seg: s,
    length: polylineLength2D(s.points),
    bearing: bearing2D(s.points[0], s.points[s.points.length - 1]),
  }));
  const geoInfos = geoSegs.map((s) => ({
    seg: s,
    length: polylineLengthGeo(s.points),
    bearing: bearingGeo(s.points[0], s.points[s.points.length - 1]),
  }));

  const result: MappedSegment[] = [];

  // For each geo segment, find the best SVG segment to pair with.
  // Multiple geo segments can map to the same SVG segment — this handles
  // routes where OSM has many more ways than the SVG has subpaths.
  for (const geo of geoInfos) {
    let bestSvg = svgInfos[0];
    let bestScore = -Infinity;

    for (const svg of svgInfos) {
      const lengthRatio = Math.min(svg.length, geo.length) / Math.max(svg.length, geo.length);
      const bearingDiff = angleDiff(svg.bearing, geo.bearing);
      // Consider both forward and reverse bearing (route direction may differ)
      const reverseBearingDiff = angleDiff(svg.bearing, (geo.bearing + 180) % 360);
      const bearingScore = 1 - Math.min(bearingDiff, reverseBearingDiff) / 180;

      const score = lengthRatio * 0.4 + bearingScore * 0.6;
      if (score > bestScore) {
        bestScore = score;
        bestSvg = svg;
      }
    }

    // Check if we need to reverse the geo segment to match SVG direction
    const forwardBearingDiff = angleDiff(bestSvg.bearing, geo.bearing);
    const reverseBearingDiff = angleDiff(bestSvg.bearing, (geo.bearing + 180) % 360);
    const geoPoints =
      reverseBearingDiff < forwardBearingDiff ? [...geo.seg.points].reverse() : geo.seg.points;

    result.push(
      buildMappedSegment(`${pisteId}_${geo.seg.label}`, bestSvg.seg.points, geoPoints),
    );
  }

  return result;
}

// ─── MappedSegment construction ──────────────────────────────────────────────

function buildMappedSegment(
  id: string,
  svgPoints: Point[],
  geoPoints: GeoPoint[],
): MappedSegment {
  return {
    id,
    svgPoints,
    geoPoints,
    svgCumulDist: cumulativeDistances2D(svgPoints),
    geoCumulDist: cumulativeDistancesGeo(geoPoints),
  };
}

// ─── Geometry utilities ──────────────────────────────────────────────────────

function dist2D(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polylineLength2D(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist2D(points[i - 1], points[i]);
  return len;
}

function cumulativeDistances2D(points: Point[]): number[] {
  const d = [0];
  for (let i = 1; i < points.length; i++) d.push(d[i - 1] + dist2D(points[i - 1], points[i]));
  return d;
}

function bearing2D(a: Point, b: Point): number {
  // Angle in degrees, 0 = up (negative y), clockwise
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

/** Haversine distance in meters */
function distGeo(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aLat = (a.lat * Math.PI) / 180;
  const bLat = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function polylineLengthGeo(points: GeoPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += distGeo(points[i - 1], points[i]);
  return len;
}

function cumulativeDistancesGeo(points: GeoPoint[]): number[] {
  const d = [0];
  for (let i = 1; i < points.length; i++) d.push(d[i - 1] + distGeo(points[i - 1], points[i]));
  return d;
}

function bearingGeo(a: GeoPoint, b: GeoPoint): number {
  const aLat = (a.lat * Math.PI) / 180;
  const bLat = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(bLat);
  const x = Math.cos(aLat) * Math.sin(bLat) - Math.sin(aLat) * Math.cos(bLat) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
