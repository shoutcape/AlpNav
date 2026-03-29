import { Container, Graphics } from "pixi.js";
import type { Piste, PisteDifficulty, Point } from "@/lib/domain/types";

const DIFFICULTY_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x0069ea,
  medium:    0xff0000,
  difficult: 0x000000,
  unknown:   0x9e9e9e,
};

const CLOSED_COLOR = 0x9e9e9e;

function pisteColor(piste: Piste): number {
  return piste.status === "closed" ? CLOSED_COLOR : DIFFICULTY_COLORS[piste.difficulty];
}

const STROKE_WIDTH = 3;
const DASH_LEN = 8;
const GAP_LEN = 6;

function drawDashedSegment(g: Graphics, seg: Point[], visualScale: number): void {
  let drawing = true;
  const dashLen = DASH_LEN * visualScale;
  const gapLen = GAP_LEN * visualScale;
  let remaining = dashLen;

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
        remaining = drawing ? dashLen : gapLen;
      }
    }
  }
}

export function drawPisteOverlay(container: Container, pistes: Piste[], visualScale: number = 1): void {
  const byColor = new Map<number, Piste[]>();

  for (const piste of pistes) {
    const color = pisteColor(piste);
    const group = byColor.get(color) ?? [];
    group.push(piste);
    byColor.set(color, group);
  }

  // Solid segments
  for (const [color, group] of byColor) {
    const g = new Graphics();

    for (const piste of group) {
      for (const segment of piste.segments) {
        if (segment.length < 2) {
          continue;
        }

        g.moveTo(segment[0].x, segment[0].y);

        for (let i = 1; i < segment.length; i++) {
          g.lineTo(segment[i].x, segment[i].y);
        }
      }
    }

    g.stroke({ width: STROKE_WIDTH * visualScale, color });
    container.addChild(g);
  }

  // Dashed ski route segments
  for (const piste of pistes) {
    if (!piste.skiRouteSegments?.length) continue;
    const color = pisteColor(piste);
    const g = new Graphics();

    for (const seg of piste.skiRouteSegments) {
      if (seg.length < 2) continue;
      drawDashedSegment(g, seg, visualScale);
    }

    g.stroke({ width: STROKE_WIDTH * visualScale, color, cap: "round", join: "round" });
    container.addChild(g);
  }
}
