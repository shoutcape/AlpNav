import { Graphics } from "pixi.js";
import type { Piste, Lift, PisteDifficulty, Point } from "@/lib/domain/types";

const LIFT_BADGE_R = 24;
const PISTE_BADGE_R = 14;

const HIGHLIGHT_GOLD = 0xffd700;

const HIGHLIGHT_PISTE_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x4da6ff,
  medium:    0xff5c5c,
  difficult: 0x555555,
  unknown:   0xbdbdbd,
};

const DASH_LEN = 8;
const GAP_LEN = 6;

function drawDashedSegment(g: Graphics, seg: Point[]): void {
  let drawing = true;
  let remaining = DASH_LEN;

  for (let i = 1; i < seg.length; i++) {
    let x0 = seg[i - 1].x;
    let y0 = seg[i - 1].y;
    const x1 = seg[i].x;
    const y1 = seg[i].y;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    let covered = 0;

    while (covered < segLen) {
      const step = Math.min(remaining, segLen - covered);
      const nx = x0 + ux * step;
      const ny = y0 + uy * step;
      if (drawing) {
        g.moveTo(x0, y0);
        g.lineTo(nx, ny);
      }
      x0 = nx;
      y0 = ny;
      covered += step;
      remaining -= step;
      if (remaining <= 0) {
        drawing = !drawing;
        remaining = drawing ? DASH_LEN : GAP_LEN;
      }
    }
  }
}

// Called with the below-lifts Graphics — pistes only
export function drawPisteHighlight(g: Graphics, item: Piste | null): void {
  g.clear();
  if (!item) return;

  const outlineColor = HIGHLIGHT_PISTE_COLORS[item.difficulty];
  const skiSegs = item.skiRouteSegments ?? [];

  // Outline pass (drawn first, behind)
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  for (const seg of skiSegs) {
    if (seg.length < 2) continue;
    drawDashedSegment(g, seg);
  }
  g.stroke({ width: 5, color: outlineColor });

  // Gold core
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  for (const seg of skiSegs) {
    if (seg.length < 2) continue;
    drawDashedSegment(g, seg);
  }
  g.stroke({ width: 3, color: HIGHLIGHT_GOLD });
}

// Called with the above-lifts Graphics — lifts only.
// Draws at the EXACT SAME sizes as drawLiftOverlay so only color changes:
//   inner line: width 4  (matches drawLiftOverlay inner)
//   terminals:  radius 9 (matches TERMINAL_RADIUS)
export function drawLiftHighlight(g: Graphics, item: Lift | null): void {
  g.clear();
  if (!item) return;

  // Inner line in gold — same width 4 as normal inner, overwrites green
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  g.stroke({ width: 4, color: HIGHLIGHT_GOLD });

  // Terminal circles in gold — same radius 9, overwrites green fill
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    const first = seg[0];
    const last = seg[seg.length - 1];
    for (const pt of [first, last]) {
      g.circle(pt.x, pt.y, 9);
      g.fill({ color: HIGHLIGHT_GOLD });
      g.circle(pt.x, pt.y, 9);
      g.stroke({ width: 2.5, color: 0x1b5e20 });
    }
  }

}

// Drawn on a layer above all marker containers — recolors badge outlines to gold.
export function drawBadgeHighlight(g: Graphics, item: Piste | Lift | null): void {
  g.clear();
  if (!item) return;

  if ("difficulty" in item) {
    // Piste — may have multiple icon positions
    for (const { x, y } of item.icons ?? []) {
      g.circle(x, y, PISTE_BADGE_R).stroke({ color: HIGHLIGHT_GOLD, width: 2 });
    }
  } else {
    // Lift — single icon
    if (item.icon) {
      g.circle(item.icon.x, item.icon.y, LIFT_BADGE_R).stroke({ color: HIGHLIGHT_GOLD, width: 2.5 });
    }
  }
}
