import { Container, Graphics } from "pixi.js";
import type { Webcam } from "@/lib/domain/types";

const BADGE_R = 18;
const BADGE_FILL = 0x1565c0;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 1.5;
const WHITE = 0xffffff;

export function drawWebcamMarkerOverlay(container: Container, webcams: Webcam[]): void {
  const bg = new Graphics();
  container.addChild(bg);
  for (const cam of webcams) {
    bg.roundRect(cam.position.x - BADGE_R, cam.position.y - BADGE_R, BADGE_R * 2, BADGE_R * 2, 10)
      .fill({ color: BADGE_FILL })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W });
  }

  const sym = new Graphics();
  container.addChild(sym);
  for (const cam of webcams) {
    drawCameraIcon(sym, cam.position.x, cam.position.y);
  }
}

function drawCameraIcon(g: Graphics, cx: number, cy: number): void {
  // Camera body
  g.roundRect(cx - 8, cy - 4, 16, 10, 2).stroke({ color: WHITE, width: 1.5 });
  // Lens circle
  g.circle(cx, cy + 1, 3.5).stroke({ color: WHITE, width: 1.5 });
  // Viewfinder bump on top-left
  g.roundRect(cx - 4, cy - 7, 5, 3, 1).fill({ color: WHITE });
}
