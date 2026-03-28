import { Container, Graphics } from "pixi.js";
import type { Webcam } from "@/lib/domain/types";

const BADGE_R = 18;
const BADGE_FILL = 0x1565c0;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;
const WHITE = 0xffffff;

export function drawWebcamMarkerOverlay(container: Container, webcams: Webcam[], visualScale: number = 1): void {
  const bg = new Graphics();
  container.addChild(bg);
  const r = BADGE_R * visualScale;
  for (const cam of webcams) {
    bg.roundRect(cam.position.x - r, cam.position.y - r, r * 2, r * 2, 10 * visualScale)
      .fill({ color: BADGE_FILL })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W * visualScale });
  }

  const sym = new Graphics();
  container.addChild(sym);
  for (const cam of webcams) {
    drawCameraIcon(sym, cam.position.x, cam.position.y, visualScale);
  }
}

function drawCameraIcon(g: Graphics, cx: number, cy: number, s: number): void {
  // Camera body
  g.roundRect(cx - 8 * s, cy - 4 * s, 16 * s, 10 * s, 2 * s).stroke({ color: WHITE, width: 1.5 * s });
  // Lens circle
  g.circle(cx, cy + 1 * s, 3.5 * s).stroke({ color: WHITE, width: 1.5 * s });
  // Viewfinder bump on top-left
  g.roundRect(cx - 4 * s, cy - 7 * s, 5 * s, 3 * s, 1 * s).fill({ color: WHITE });
}
