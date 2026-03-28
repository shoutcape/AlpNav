import { Container, Graphics } from "pixi.js";
import type { InfrastructureCategory, InfrastructurePoi } from "@/lib/domain/types";

const BADGE_SIZE = 32;
const BADGE_CORNER = 4;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;

const BADGE_FILL: Record<InfrastructureCategory, number> = {
  parking: 0x2563eb,
  bus:     0x16a34a,
  info:    0xd97706,
  rescue:  0xdc2626,
};

const WHITE = 0xffffff;

export function drawInfrastructureOverlay(container: Container, pois: InfrastructurePoi[], visualScale: number = 1): void {
  // Pass 1 — badge backgrounds
  const bg = new Graphics();
  container.addChild(bg);
  const size = BADGE_SIZE * visualScale;
  const corner = BADGE_CORNER * visualScale;
  for (const poi of pois) {
    const { x, y } = poi.position;
    bg.roundRect(x - size / 2, y - size / 2, size, size, corner)
      .fill({ color: BADGE_FILL[poi.category] })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W * visualScale });
  }

  // Pass 2 — symbols
  const sym = new Graphics();
  container.addChild(sym);
  for (const poi of pois) {
    drawSymbol(sym, poi.position.x, poi.position.y, poi.category, visualScale);
  }
}

function drawSymbol(g: Graphics, cx: number, cy: number, category: InfrastructureCategory, s: number): void {
  switch (category) {
    case "parking":
      drawP(g, cx, cy, s);
      break;
    case "bus":
      drawB(g, cx, cy, s);
      break;
    case "info":
      drawI(g, cx, cy, s);
      break;
    case "rescue":
      drawCross(g, cx, cy, s);
      break;
  }
}

// "P" — vertical stroke + right-side bump (D-shape top half)
function drawP(g: Graphics, cx: number, cy: number, s: number): void {
  // Vertical stem
  g.moveTo(cx - 3 * s, cy - 7 * s).lineTo(cx - 3 * s, cy + 7 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });
  // Top bump: arc from top of stem curving right then back
  g.moveTo(cx - 3 * s, cy - 7 * s).lineTo(cx + 2 * s, cy - 7 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });
  g.moveTo(cx + 2 * s, cy - 7 * s).lineTo(cx + 4 * s, cy - 5 * s).lineTo(cx + 4 * s, cy - 2 * s).lineTo(cx + 2 * s, cy)
    .stroke({ color: WHITE, width: 2 * s, cap: "round", join: "round" });
  g.moveTo(cx + 2 * s, cy).lineTo(cx - 3 * s, cy)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });
}

// "B" — vertical stroke + two right-side bumps
function drawB(g: Graphics, cx: number, cy: number, s: number): void {
  // Vertical stem
  g.moveTo(cx - 3 * s, cy - 7 * s).lineTo(cx - 3 * s, cy + 7 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });
  // Top bump
  g.moveTo(cx - 3 * s, cy - 7 * s).lineTo(cx + 2 * s, cy - 7 * s).lineTo(cx + 4 * s, cy - 5 * s).lineTo(cx + 4 * s, cy - 2 * s).lineTo(cx + 2 * s, cy - 0.5 * s).lineTo(cx - 3 * s, cy - 0.5 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round", join: "round" });
  // Bottom bump
  g.moveTo(cx - 3 * s, cy - 0.5 * s).lineTo(cx + 3 * s, cy - 0.5 * s).lineTo(cx + 5 * s, cy + 1.5 * s).lineTo(cx + 5 * s, cy + 5 * s).lineTo(cx + 3 * s, cy + 7 * s).lineTo(cx - 3 * s, cy + 7 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round", join: "round" });
}

// "i" — dot above + vertical stroke
function drawI(g: Graphics, cx: number, cy: number, s: number): void {
  // Dot
  g.circle(cx, cy - 5 * s, 1.5 * s).fill({ color: WHITE });
  // Stroke
  g.moveTo(cx, cy - 2 * s).lineTo(cx, cy + 7 * s)
    .stroke({ color: WHITE, width: 2.5 * s, cap: "round" });
}

// Medical cross — filled rectangle arms
function drawCross(g: Graphics, cx: number, cy: number, s: number): void {
  g.rect(cx - 2.5 * s, cy - 7 * s, 5 * s, 14 * s).fill({ color: WHITE });
  g.rect(cx - 7 * s, cy - 2.5 * s, 14 * s, 5 * s).fill({ color: WHITE });
}
