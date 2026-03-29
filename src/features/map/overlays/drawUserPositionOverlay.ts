import { Container, Graphics, Ticker } from "pixi.js";
import type { Point } from "@/lib/domain/types";

const DOT_COLOR = 0x2563eb; // blue-600
const DOT_RADIUS = 8;
const DOT_BORDER = 2.5;
const ACCURACY_COLOR = 0x2563eb;
const ACCURACY_ALPHA = 0.12;

const HALO_COLOR = 0x60a5fa; // blue-400, brighter than dot
const HALO_MIN_RADIUS = 2.0; // multiplier of DOT_RADIUS
const HALO_MAX_RADIUS = 5.0;
const HALO_MAX_ALPHA = 0.55;
const HALO_SPEED = 0.02; // radians per frame

let activeTicker: (() => void) | null = null;

/**
 * Draws a user position dot with accuracy circle on the panorama.
 * When `breathing` is true, adds a pulsing halo ring around the dot.
 * Call with `position: null` to clear the overlay.
 */
export function drawUserPositionOverlay(
  container: Container,
  position: Point | null,
  accuracyRadius: number, // in panorama pixels
  visualScale: number = 1,
  breathing: boolean = false,
): void {
  // Clean up previous animation
  if (activeTicker) {
    activeTicker();
    activeTicker = null;
  }

  container.removeChildren();

  if (!position) return;

  // Accuracy circle
  if (accuracyRadius > DOT_RADIUS * visualScale) {
    const acc = new Graphics();
    acc.circle(position.x, position.y, accuracyRadius);
    acc.fill({ color: ACCURACY_COLOR, alpha: ACCURACY_ALPHA });
    container.addChild(acc);
  }

  // Breathing halo (behind dot)
  if (breathing) {
    const halo = new Graphics();
    container.addChild(halo);

    let phase = 0;
    let cycles = 0;
    const ticker = Ticker.shared;
    const MAX_CYCLES = 3;

    const onTick = () => {
      const prevSin = Math.sin(phase);
      phase += HALO_SPEED;
      const curSin = Math.sin(phase);

      // Count a cycle when sine crosses from negative to positive
      if (prevSin < 0 && curSin >= 0) cycles++;
      if (cycles >= MAX_CYCLES) {
        halo.clear();
        ticker.remove(onTick);
        activeTicker = null;
        return;
      }

      const t = (curSin + 1) / 2; // 0 → 1 → 0
      const radius = (HALO_MIN_RADIUS + t * (HALO_MAX_RADIUS - HALO_MIN_RADIUS)) * DOT_RADIUS * visualScale;
      const alpha = HALO_MAX_ALPHA * (1 - t * 0.7);

      halo.clear();
      halo.circle(position.x, position.y, radius);
      halo.fill({ color: HALO_COLOR, alpha });
    };

    ticker.add(onTick);
    activeTicker = () => ticker.remove(onTick);
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
