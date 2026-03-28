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

export function drawGastronomyBadge(g: Graphics, spot: GastronomySpot, visualScale: number = 1): void {
  const { x, y } = spot.position;
  g.circle(x, y, BADGE_R * visualScale)
    .fill({ color: BADGE_FILL[spot.type] })
    .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W * visualScale });
  drawForkKnife(g, x, y, visualScale);
}

export function drawGastronomyMarkerOverlay(container: Container, spots: GastronomySpot[], visualScale: number = 1): void {
  const g = new Graphics();
  container.addChild(g);
  for (const spot of spots) {
    drawGastronomyBadge(g, spot, visualScale);
  }
}

function drawForkKnife(g: Graphics, cx: number, cy: number, s: number): void {
  // Fork (left side): three tines at top, handle below
  // Tines
  g.moveTo(cx - 5 * s, cy - 8 * s).lineTo(cx - 5 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });
  g.moveTo(cx - 3 * s, cy - 8 * s).lineTo(cx - 3 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });
  g.moveTo(cx - 1 * s, cy - 8 * s).lineTo(cx - 1 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });
  // Fork arch connecting tines
  g.moveTo(cx - 5 * s, cy - 3 * s).lineTo(cx - 3 * s, cy - 1 * s).lineTo(cx - 1 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round", join: "round" });
  // Fork handle
  g.moveTo(cx - 3 * s, cy - 1 * s).lineTo(cx - 3 * s, cy + 8 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });

  // Knife (right side): straight blade with slight tip, handle below
  g.moveTo(cx + 3 * s, cy - 8 * s).lineTo(cx + 5 * s, cy - 4 * s).lineTo(cx + 3 * s, cy - 2 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round", join: "round" });
  // Knife handle
  g.moveTo(cx + 3 * s, cy - 2 * s).lineTo(cx + 3 * s, cy + 8 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });
}
