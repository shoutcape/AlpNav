import { Container, Graphics } from "pixi.js";
import type { InfrastructureCategory, InfrastructurePoi } from "@/lib/domain/types";

const BADGE_R = 16;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;

const BADGE_FILL: Record<InfrastructureCategory, number> = {
  parking: 0x2563eb,
  bus:     0x16a34a,
  info:    0xd97706,
  rescue:  0xdc2626,
};

const WHITE = 0xffffff;

export function drawInfrastructureOverlay(container: Container, pois: InfrastructurePoi[]): void {
  // Pass 1 — badge backgrounds
  const bg = new Graphics();
  container.addChild(bg);
  for (const poi of pois) {
    const { x, y } = poi.position;
    bg.circle(x, y, BADGE_R)
      .fill({ color: BADGE_FILL[poi.category] })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W });
  }

  // Pass 2 — symbols
  const sym = new Graphics();
  container.addChild(sym);
  for (const poi of pois) {
    drawSymbol(sym, poi.position.x, poi.position.y, poi.category);
  }
}

function drawSymbol(g: Graphics, cx: number, cy: number, category: InfrastructureCategory): void {
  switch (category) {
    case "parking":
      drawP(g, cx, cy);
      break;
    case "bus":
      drawB(g, cx, cy);
      break;
    case "info":
      drawI(g, cx, cy);
      break;
    case "rescue":
      drawCross(g, cx, cy);
      break;
  }
}

// "P" — vertical stroke + right-side bump (D-shape top half)
function drawP(g: Graphics, cx: number, cy: number): void {
  // Vertical stem
  g.moveTo(cx - 3, cy - 7).lineTo(cx - 3, cy + 7)
    .stroke({ color: WHITE, width: 2, cap: "round" });
  // Top bump: arc from top of stem curving right then back
  g.moveTo(cx - 3, cy - 7).lineTo(cx + 2, cy - 7)
    .stroke({ color: WHITE, width: 2, cap: "round" });
  g.moveTo(cx + 2, cy - 7).lineTo(cx + 4, cy - 5).lineTo(cx + 4, cy - 2).lineTo(cx + 2, cy)
    .stroke({ color: WHITE, width: 2, cap: "round", join: "round" });
  g.moveTo(cx + 2, cy).lineTo(cx - 3, cy)
    .stroke({ color: WHITE, width: 2, cap: "round" });
}

// "B" — vertical stroke + two right-side bumps
function drawB(g: Graphics, cx: number, cy: number): void {
  // Vertical stem
  g.moveTo(cx - 3, cy - 7).lineTo(cx - 3, cy + 7)
    .stroke({ color: WHITE, width: 2, cap: "round" });
  // Top bump
  g.moveTo(cx - 3, cy - 7).lineTo(cx + 2, cy - 7).lineTo(cx + 4, cy - 5).lineTo(cx + 4, cy - 2).lineTo(cx + 2, cy - 0.5).lineTo(cx - 3, cy - 0.5)
    .stroke({ color: WHITE, width: 1.5, cap: "round", join: "round" });
  // Bottom bump
  g.moveTo(cx - 3, cy - 0.5).lineTo(cx + 3, cy - 0.5).lineTo(cx + 5, cy + 1.5).lineTo(cx + 5, cy + 5).lineTo(cx + 3, cy + 7).lineTo(cx - 3, cy + 7)
    .stroke({ color: WHITE, width: 1.5, cap: "round", join: "round" });
}

// "i" — dot above + vertical stroke
function drawI(g: Graphics, cx: number, cy: number): void {
  // Dot
  g.circle(cx, cy - 5, 1.5).fill({ color: WHITE });
  // Stroke
  g.moveTo(cx, cy - 2).lineTo(cx, cy + 7)
    .stroke({ color: WHITE, width: 2.5, cap: "round" });
}

// Cross — horizontal + vertical strokes
function drawCross(g: Graphics, cx: number, cy: number): void {
  g.moveTo(cx, cy - 7).lineTo(cx, cy + 7)
    .stroke({ color: WHITE, width: 2.5, cap: "round" });
  g.moveTo(cx - 5, cy).lineTo(cx + 5, cy)
    .stroke({ color: WHITE, width: 2.5, cap: "round" });
}
