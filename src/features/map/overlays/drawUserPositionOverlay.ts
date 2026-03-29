import { Container, Graphics } from "pixi.js";
import type { Point } from "@/lib/domain/types";

const DOT_COLOR = 0x2563eb; // blue-600
const DOT_RADIUS = 8;
const DOT_BORDER = 2.5;
const ACCURACY_COLOR = 0x2563eb;
const ACCURACY_ALPHA = 0.12;

/**
 * Draws a user position dot with accuracy circle on the panorama.
 * Call with `position: null` to clear the overlay.
 */
export function drawUserPositionOverlay(
  container: Container,
  position: Point | null,
  accuracyRadius: number, // in panorama pixels
  visualScale: number = 1,
): void {
  container.removeChildren();

  if (!position) return;

  // Accuracy circle
  if (accuracyRadius > DOT_RADIUS * visualScale) {
    const acc = new Graphics();
    acc.circle(position.x, position.y, accuracyRadius);
    acc.fill({ color: ACCURACY_COLOR, alpha: ACCURACY_ALPHA });
    container.addChild(acc);
  }

  // White border
  const border = new Graphics();
  border.circle(position.x, position.y, (DOT_RADIUS + DOT_BORDER) * visualScale);
  border.fill({ color: 0xffffff });
  container.addChild(border);

  // Blue dot
  const dot = new Graphics();
  dot.circle(position.x, position.y, DOT_RADIUS * visualScale);
  dot.fill({ color: DOT_COLOR });
  container.addChild(dot);
}
