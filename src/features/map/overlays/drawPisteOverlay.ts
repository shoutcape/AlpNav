import { Container, Graphics } from "pixi.js";
import type { Piste, PisteDifficulty } from "@/lib/domain/types";

const DIFFICULTY_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x0069ea,
  medium:    0xff0000,
  difficult: 0x000000,
  unknown:   0x9e9e9e,
};

const STROKE_WIDTH = 3;

export function drawPisteOverlay(container: Container, pistes: Piste[]): void {
  const byDifficulty = new Map<PisteDifficulty, Piste[]>();

  for (const piste of pistes) {
    const group = byDifficulty.get(piste.difficulty) ?? [];
    group.push(piste);
    byDifficulty.set(piste.difficulty, group);
  }

  for (const [difficulty, group] of byDifficulty) {
    const color = DIFFICULTY_COLORS[difficulty];
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

    g.stroke({ width: STROKE_WIDTH, color });
    container.addChild(g);
  }
}
