import { Container, Graphics } from "pixi.js";
import type { SportFunCategory, SportFunPoi } from "@/lib/domain/types";

export const SPORT_FUN_BADGE_R = 20;

export const BADGE_FILL: Record<SportFunCategory, number> = {
  skimovie: 0x7c3aed,
  speedcheck: 0x0284c7,
  skidepot: 0xd97706,
  photopoint: 0xdb2777,
  viewpoint: 0x16a34a,
};

function hexPts(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + i * (Math.PI / 3);
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

export function drawSportFunBadge(g: Graphics, poi: SportFunPoi, visualScale: number = 1): void {
  const { x, y } = poi.position;
  const r = SPORT_FUN_BADGE_R * visualScale;
  g.poly(hexPts(x, y, r))
    .fill({ color: BADGE_FILL[poi.sportCategory] })
    .stroke({ color: 0x000000, width: 1.5 * visualScale });
  drawIcon(g, x, y, poi.sportCategory, visualScale);
}

export function drawSportFunOverlay(container: Container, pois: SportFunPoi[], visualScale: number = 1): void {
  const g = new Graphics();
  container.addChild(g);
  for (const poi of pois) {
    drawSportFunBadge(g, poi, visualScale);
  }
}

function drawIcon(g: Graphics, cx: number, cy: number, cat: SportFunCategory, s: number) {
  const W = 0xffffff;
  switch (cat) {
    case "skimovie":
      g.poly([cx - 4 * s, cy - 6 * s, cx + 7 * s, cy, cx - 4 * s, cy + 6 * s]).fill({ color: W });
      break;
    case "speedcheck":
      g.moveTo(cx + 3 * s, cy - 8 * s)
        .lineTo(cx - 2 * s, cy - 1 * s)
        .lineTo(cx + 3 * s, cy - 1 * s)
        .lineTo(cx - 3 * s, cy + 8 * s)
        .stroke({ color: W, width: 2.5 * s, cap: "round", join: "round" });
      break;
    case "skidepot":
      g.moveTo(cx - 5 * s, cy - 7 * s).lineTo(cx + 5 * s, cy + 7 * s)
        .stroke({ color: W, width: 2 * s, cap: "round" });
      g.moveTo(cx + 5 * s, cy - 7 * s).lineTo(cx - 5 * s, cy + 7 * s)
        .stroke({ color: W, width: 2 * s, cap: "round" });
      for (const [dx, dy] of [[-5, -7], [5, -7], [-5, 7], [5, 7]])
        g.circle(cx + dx * s, cy + dy * s, 2 * s).fill({ color: W });
      break;
    case "photopoint":
      g.roundRect(cx - 7 * s, cy - 3 * s, 14 * s, 9 * s, 2 * s).stroke({ color: W, width: 1.5 * s });
      g.circle(cx, cy + 1 * s, 3 * s).stroke({ color: W, width: 1.5 * s });
      g.roundRect(cx - 5 * s, cy - 6 * s, 4 * s, 3 * s, 1 * s).fill({ color: W });
      break;
    case "viewpoint":
      g.poly([cx - 6 * s, cy + 7 * s, cx - 1 * s, cy - 5 * s, cx + 4 * s, cy + 7 * s]).fill({ color: W, alpha: 0.5 });
      g.poly([cx - 3 * s, cy + 7 * s, cx + 3 * s, cy - 8 * s, cx + 9 * s, cy + 7 * s]).fill({ color: W });
      break;
  }
}
