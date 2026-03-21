import { Graphics } from "pixi.js";
import type { Piste, Lift, PisteDifficulty } from "@/lib/domain/types";

const HIGHLIGHT_STROKE_WIDTH = 5;

const HIGHLIGHT_PISTE_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x42a5f5,
  medium:    0xff5252,
  difficult: 0x757575,
  unknown:   0xbdbdbd,
};

export function drawHighlightOverlay(g: Graphics, item: Piste | Lift | null): void {
  g.clear();

  if (!item) return;

  if ("difficulty" in item) {
    // Piste
    const color = HIGHLIGHT_PISTE_COLORS[item.difficulty];
    for (const seg of item.segments) {
      if (seg.length < 2) continue;
      g.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
    }
    g.stroke({ width: HIGHLIGHT_STROKE_WIDTH, color });
  } else {
    // Lift — two-pass outline + inner in brighter green
    for (const seg of item.segments) {
      if (seg.length < 2) continue;
      g.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
    }
    g.stroke({ width: 10, color: 0x2e7d32 });

    for (const seg of item.segments) {
      if (seg.length < 2) continue;
      g.moveTo(seg[0].x, seg[0].y);
      for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
    }
    g.stroke({ width: 6, color: 0x00e676 });

    // Terminal circles at segment endpoints
    for (const seg of item.segments) {
      if (seg.length < 2) continue;
      const first = seg[0];
      const last = seg[seg.length - 1];
      for (const pt of [first, last]) {
        g.circle(pt.x, pt.y, 9);
        g.fill({ color: 0x00e676 });
        g.circle(pt.x, pt.y, 9);
        g.stroke({ width: 2.5, color: 0x2e7d32 });
      }
    }

    // Icon badge highlight ring
    if (item.icon) {
      g.circle(item.icon.x, item.icon.y, 28);
      g.stroke({ width: 3, color: 0x00e676 });
    }
  }
}
