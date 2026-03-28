import { Container, Graphics } from "pixi.js";
import type { Webcam } from "@/lib/domain/types";

const BADGE_R = 18;
const BADGE_FILL = 0x1565c0;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;
const WHITE = 0xffffff;

export function drawWebcamBadge(g: Graphics, cam: Webcam, visualScale: number = 1): void {
  const { x, y } = cam.position;
  const r = BADGE_R * visualScale;
  g.roundRect(x - r, y - r, r * 2, r * 2, 10 * visualScale)
    .fill({ color: BADGE_FILL })
    .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W * visualScale });
  drawCameraIcon(g, x, y, visualScale);
}

export function drawWebcamMarkerOverlay(container: Container, webcams: Webcam[], visualScale: number = 1): void {
  const g = new Graphics();
  container.addChild(g);
  for (const cam of webcams) {
    drawWebcamBadge(g, cam, visualScale);
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
