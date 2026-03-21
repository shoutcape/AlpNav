import { Graphics } from "pixi.js";
import type { Piste, Lift, PisteDifficulty } from "@/lib/domain/types";

const HIGHLIGHT_GOLD = 0xffd700;

const HIGHLIGHT_PISTE_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x42a5f5,
  medium:    0xff5252,
  difficult: 0x757575,
  unknown:   0xbdbdbd,
};

// Called with the below-lifts Graphics — pistes only
export function drawPisteHighlight(g: Graphics, item: Piste | null): void {
  g.clear();
  if (!item) return;

  const outlineColor = HIGHLIGHT_PISTE_COLORS[item.difficulty];

  // 1px difficulty-color border (drawn first, behind)
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  g.stroke({ width: 5, color: outlineColor });

  // Gold core — same width as normal piste stroke
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
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

  // Icon badge ring — radius 26 sits flush against the badge edge (BADGE_R 24 + stroke 1 = 25)
  if (item.icon) {
    g.circle(item.icon.x, item.icon.y, 26);
    g.stroke({ width: 3, color: HIGHLIGHT_GOLD });
  }
}
