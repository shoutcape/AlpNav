import { Container, Graphics } from "pixi.js";
import type { Lift } from "@/lib/domain/types";

const TERMINAL_RADIUS = 9; // 2.25 SVG units × 4 world scale

export function drawLiftOverlay(container: Container, lifts: Lift[]): void {
  const outline = new Graphics();
  const inner = new Graphics();
  const terminals = new Graphics();

  for (const lift of lifts) {
    for (const segment of lift.segments) {
      if (segment.length < 2) {
        continue;
      }

      outline.moveTo(segment[0].x, segment[0].y);
      inner.moveTo(segment[0].x, segment[0].y);

      for (let i = 1; i < segment.length; i++) {
        outline.lineTo(segment[i].x, segment[i].y);
        inner.lineTo(segment[i].x, segment[i].y);
      }

      const first = segment[0];
      const last = segment[segment.length - 1];

      terminals.circle(first.x, first.y, TERMINAL_RADIUS);
      terminals.fill({ color: 0x66bb6a });
      terminals.circle(first.x, first.y, TERMINAL_RADIUS);
      terminals.stroke({ width: 2.5, color: 0x1b5e20 });

      terminals.circle(last.x, last.y, TERMINAL_RADIUS);
      terminals.fill({ color: 0x66bb6a });
      terminals.circle(last.x, last.y, TERMINAL_RADIUS);
      terminals.stroke({ width: 2.5, color: 0x1b5e20 });
    }
  }

  outline.stroke({ width: 8, color: 0x1b5e20 });
  inner.stroke({ width: 4, color: 0x66bb6a });

  container.addChild(outline);
  container.addChild(inner);
  container.addChild(terminals);
}
