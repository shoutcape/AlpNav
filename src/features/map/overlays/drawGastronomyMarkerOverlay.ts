import { Container, Graphics } from "pixi.js";
import type { GastronomySpot, GastronomyType } from "@/lib/domain/types";

const BADGE_R = 18;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;

const BADGE_FILL: Record<GastronomyType, number> = {
  restaurant: 0xe8a020,
  bar:        0x9b4dca,
  cafe:       0x20a090,
};

const WHITE = 0xffffff;

export function drawGastronomyMarkerOverlay(container: Container, spots: GastronomySpot[]): void {
  // Pass 1 — badge backgrounds
  const bg = new Graphics();
  container.addChild(bg);
  for (const spot of spots) {
    const { x, y } = spot.position;
    bg.circle(x, y, BADGE_R)
      .fill({ color: BADGE_FILL[spot.type] })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W });
  }

  // Pass 2 — fork-and-knife symbols
  const sym = new Graphics();
  container.addChild(sym);
  for (const spot of spots) {
    drawForkKnife(sym, spot.position.x, spot.position.y);
  }
}

function drawForkKnife(g: Graphics, cx: number, cy: number): void {
  // Fork (left side): three tines at top, handle below
  // Tines
  g.moveTo(cx - 5, cy - 8).lineTo(cx - 5, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });
  g.moveTo(cx - 3, cy - 8).lineTo(cx - 3, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });
  g.moveTo(cx - 1, cy - 8).lineTo(cx - 1, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });
  // Fork arch connecting tines
  g.moveTo(cx - 5, cy - 3).lineTo(cx - 3, cy - 1).lineTo(cx - 1, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round", join: "round" });
  // Fork handle
  g.moveTo(cx - 3, cy - 1).lineTo(cx - 3, cy + 8)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });

  // Knife (right side): straight blade with slight tip, handle below
  g.moveTo(cx + 3, cy - 8).lineTo(cx + 5, cy - 4).lineTo(cx + 3, cy - 2)
    .stroke({ color: WHITE, width: 1.5, cap: "round", join: "round" });
  // Knife handle
  g.moveTo(cx + 3, cy - 2).lineTo(cx + 3, cy + 8)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });
}
