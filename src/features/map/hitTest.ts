import type { Piste, Lift, GastronomySpot, Point } from "@/lib/domain/types";

const HIT_THRESHOLD = 20; // world units — tune after testing
const ICON_HIT_RADIUS = 26; // world units — badge is r=24, gives ~2 units of extra margin
const GASTRO_HIT_RADIUS = 20;

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function minDistToSegments(px: number, py: number, segments: Point[][]): number {
  let min = Infinity;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      const d = pointToSegmentDist(px, py, seg[i - 1].x, seg[i - 1].y, seg[i].x, seg[i].y);
      if (d < min) min = d;
    }
  }
  return min;
}

export function hitTestOverlays(
  px: number,
  py: number,
  pistes: Piste[],
  lifts: Lift[],
  gastronomy: GastronomySpot[] = [],
  threshold = HIT_THRESHOLD,
): Piste | Lift | GastronomySpot | null {
  // Gastronomy point test — highest priority
  for (const spot of gastronomy) {
    const dx = px - spot.position.x;
    const dy = py - spot.position.y;
    if (Math.sqrt(dx * dx + dy * dy) <= GASTRO_HIT_RADIUS) return spot;
  }

  // Icon snap — highest priority
  for (const lift of lifts) {
    if (!lift.icon) continue;
    const d = Math.hypot(px - lift.icon.x, py - lift.icon.y);
    if (d < ICON_HIT_RADIUS) return lift;
  }

  let best: Piste | Lift | null = null;
  let bestDist = threshold;

  for (const lift of lifts) {
    const d = minDistToSegments(px, py, lift.segments);
    if (d < bestDist) { bestDist = d; best = lift; }
  }

  for (const piste of pistes) {
    const allSegs = piste.skiRouteSegments
      ? [...piste.segments, ...piste.skiRouteSegments]
      : piste.segments;
    const d = minDistToSegments(px, py, allSegs);
    if (d < bestDist) { bestDist = d; best = piste; }
  }

  return best;
}
