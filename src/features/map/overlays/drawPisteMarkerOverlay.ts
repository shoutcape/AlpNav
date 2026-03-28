import { Container, Graphics, Text } from "pixi.js";
import type { Piste, PisteDifficulty } from "@/lib/domain/types";

const BADGE_R = 14;
const CLOSED_COLOR = 0x9e9e9e;
const DIFFICULTY_COLORS: Record<PisteDifficulty, number> = {
  easy: 0x0069ea,
  medium: 0xff0000,
  difficult: 0x000000,
  unknown: 0x9e9e9e,
};

export function drawPisteBadge(g: Graphics, piste: Piste, cx: number, cy: number, visualScale: number = 1): void {
  const radius = BADGE_R * visualScale;
  const SLASH_INSET = radius * 0.707; // edge-to-edge at 45°
  const fill = piste.status === "closed" ? CLOSED_COLOR : DIFFICULTY_COLORS[piste.difficulty];
  
  g.circle(cx, cy, radius).fill({ color: fill }).stroke({ color: 0x000000, width: 1.5 * visualScale });
  if (piste.status === "closed") {
    g.moveTo(cx - SLASH_INSET, cy + SLASH_INSET)
     .lineTo(cx + SLASH_INSET, cy - SLASH_INSET)
     .moveTo(cx - SLASH_INSET, cy - SLASH_INSET)
     .lineTo(cx + SLASH_INSET, cy + SLASH_INSET)
     .stroke({ color: 0x000000, width: 2 * visualScale, alpha: 0.8 });
  }

  if (piste.number) {
    const label = new Text({
      text: piste.number,
      style: { fill: 0xffffff, fontFamily: "Arial", fontSize: 14 * visualScale, fontWeight: "bold" },
    });
    label.anchor.set(0.5);
    label.position.set(cx, cy);
    g.addChild(label);
  }
}

export function drawPisteMarkerOverlay(container: Container, pistes: Piste[], visualScale: number = 1): void {
  for (const piste of pistes) {
    if (!piste.icons?.length || !piste.number) continue;
    for (const { x, y } of piste.icons) {
      const g = new Graphics();
      drawPisteBadge(g, piste, x, y, visualScale);
      container.addChild(g);
    }
  }
}
