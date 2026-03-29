import { Container, Graphics, Ticker } from "pixi.js";
import type { Point } from "@/lib/domain/types";

// Precise dot (anchors: lifts, restaurants)
const DOT_COLOR = 0x2563eb; // blue-600
const DOT_RADIUS = 8;
const DOT_BORDER = 2.5;

// Estimated area circle (route interpolation)
const AREA_COLOR = 0x2563eb;
const AREA_FILL_ALPHA = 0.18;
const AREA_STROKE_ALPHA = 0.5;
const AREA_STROKE_WIDTH = 2;
const AREA_RADIUS = 28;
const CENTER_DOT_RADIUS = 3;
const CENTER_DOT_ALPHA = 0.7;

// Breathing halo
const HALO_COLOR = 0x60a5fa; // blue-400
const HALO_MAX_ALPHA = 0.35;
const HALO_SPEED = 0.02;

let activeTicker: (() => void) | null = null;

/**
 * Draws user position on the panorama.
 * `precise`: true for anchor snaps (exact dot), false for route interpolation (area circle).
 * `breathing`: pulsing halo on follow-toggle.
 */
export function drawUserPositionOverlay(
  container: Container,
  position: Point | null,
  visualScale: number = 1,
  precise: boolean = false,
  breathing: boolean = false,
): void {
  if (activeTicker) {
    activeTicker();
    activeTicker = null;
  }

  container.removeChildren();

  if (!position) return;

  // Breathing halo (behind everything)
  if (breathing) {
    const baseRadius = precise ? DOT_RADIUS : AREA_RADIUS;
    const halo = new Graphics();
    container.addChild(halo);

    let phase = 0;
    let cycles = 0;
    const ticker = Ticker.shared;

    const onTick = () => {
      const prevSin = Math.sin(phase);
      phase += HALO_SPEED;
      const curSin = Math.sin(phase);

      if (prevSin < 0 && curSin >= 0) cycles++;
      if (cycles >= 3) {
        halo.clear();
        ticker.remove(onTick);
        activeTicker = null;
        return;
      }

      const t = (curSin + 1) / 2;
      const radius = (1.5 + t * 1.5) * baseRadius * visualScale;
      const alpha = HALO_MAX_ALPHA * (1 - t * 0.7);

      halo.clear();
      halo.circle(position.x, position.y, radius);
      halo.fill({ color: HALO_COLOR, alpha });
    };

    ticker.add(onTick);
    activeTicker = () => ticker.remove(onTick);
  }

  if (precise) {
    // Exact dot with white border (anchor snap)
    const border = new Graphics();
    border.circle(position.x, position.y, (DOT_RADIUS + DOT_BORDER) * visualScale);
    border.fill({ color: 0xffffff });
    container.addChild(border);

    const dot = new Graphics();
    dot.circle(position.x, position.y, DOT_RADIUS * visualScale);
    dot.fill({ color: DOT_COLOR });
    container.addChild(dot);
  } else {
    // Estimated area circle (route interpolation)
    const radius = AREA_RADIUS * visualScale;
    const area = new Graphics();
    area.circle(position.x, position.y, radius);
    area.fill({ color: AREA_COLOR, alpha: AREA_FILL_ALPHA });
    area.stroke({ width: AREA_STROKE_WIDTH * visualScale, color: AREA_COLOR, alpha: AREA_STROKE_ALPHA });
    container.addChild(area);

    const dot = new Graphics();
    dot.circle(position.x, position.y, CENTER_DOT_RADIUS * visualScale);
    dot.fill({ color: AREA_COLOR, alpha: CENTER_DOT_ALPHA });
    container.addChild(dot);
  }
}
