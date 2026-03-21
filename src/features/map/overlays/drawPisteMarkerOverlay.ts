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

export function drawPisteMarkerOverlay(container: Container, pistes: Piste[]): void {
  const bg = new Graphics();
  container.addChild(bg);

  const SLASH_INSET = BADGE_R * 0.707; // edge-to-edge at 45°

  for (const piste of pistes) {
    if (!piste.icons?.length || !piste.number) continue;
    const fill = piste.status === "closed" ? CLOSED_COLOR : DIFFICULTY_COLORS[piste.difficulty];
    for (const { x, y } of piste.icons) {
      bg.circle(x, y, BADGE_R).fill({ color: fill }).stroke({ color: 0x000000, width: 1.5 });
      if (piste.status === "closed") {
        bg.moveTo(x - SLASH_INSET, y + SLASH_INSET)
          .lineTo(x + SLASH_INSET, y - SLASH_INSET)
          .moveTo(x - SLASH_INSET, y - SLASH_INSET)
          .lineTo(x + SLASH_INSET, y + SLASH_INSET)
          .stroke({ color: 0x000000, width: 2, alpha: 0.8 });
      }
    }
  }

  for (const piste of pistes) {
    if (!piste.icons?.length || !piste.number) continue;
    for (const { x, y } of piste.icons) {
      const label = new Text({
        text: piste.number,
        style: { fill: 0xffffff, fontFamily: "Arial", fontSize: 14, fontWeight: "bold" },
      });
      label.anchor.set(0.5);
      label.position.set(x, y);
      container.addChild(label);
    }
  }
}
