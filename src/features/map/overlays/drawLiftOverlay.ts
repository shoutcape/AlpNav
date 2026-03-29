import { Container, Graphics } from "pixi.js";
import type { Lift } from "@/lib/domain/types";

const TERMINAL_RADIUS = 9; // 2.25 SVG units × 4 world scale

const OPEN_INNER = 0x66bb6a;
const OPEN_OUTLINE = 0x1b5e20;
const CLOSED_INNER = 0x9e9e9e;
const CLOSED_OUTLINE = 0x616161;

export function drawLiftOverlay(container: Container, lifts: Lift[], visualScale: number = 1): void {
  const openOutline = new Graphics();
  const openInner = new Graphics();
  const closedOutline = new Graphics();
  const closedInner = new Graphics();
  const terminals = new Graphics();

  const termRadius = TERMINAL_RADIUS * visualScale;

  for (const lift of lifts) {
    const isClosed = lift.status === "closed";
    const outline = isClosed ? closedOutline : openOutline;
    const inner = isClosed ? closedInner : openInner;
    const innerColor = isClosed ? CLOSED_INNER : OPEN_INNER;
    const outlineColor = isClosed ? CLOSED_OUTLINE : OPEN_OUTLINE;

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

      terminals.circle(first.x, first.y, termRadius);
      terminals.fill({ color: innerColor });
      terminals.circle(first.x, first.y, termRadius);
      terminals.stroke({ width: 2.5 * visualScale, color: outlineColor });

      terminals.circle(last.x, last.y, termRadius);
      terminals.fill({ color: innerColor });
      terminals.circle(last.x, last.y, termRadius);
      terminals.stroke({ width: 2.5 * visualScale, color: outlineColor });
    }
  }

  openOutline.stroke({ width: 8 * visualScale, color: OPEN_OUTLINE });
  openInner.stroke({ width: 4 * visualScale, color: OPEN_INNER });
  
  closedOutline.stroke({ width: 8 * visualScale, color: CLOSED_OUTLINE });
  closedInner.stroke({ width: 4 * visualScale, color: CLOSED_INNER });

  container.addChild(openOutline);
  container.addChild(closedOutline);
  container.addChild(openInner);
  container.addChild(closedInner);
  container.addChild(terminals);
}