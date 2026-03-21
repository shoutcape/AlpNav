import type { Piste, Lift, Point } from "@/lib/domain/types";

const HIT_THRESHOLD = 20; // world units — tune after testing

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
  threshold = HIT_THRESHOLD,
): Piste | Lift | null {
  let best: Piste | Lift | null = null;
  let bestDist = threshold;

  for (const lift of lifts) {
    const d = minDistToSegments(px, py, lift.segments);
    if (d < bestDist) { bestDist = d; best = lift; }
  }

  for (const piste of pistes) {
    const d = minDistToSegments(px, py, piste.segments);
    if (d < bestDist) { bestDist = d; best = piste; }
  }

  return best;
}
