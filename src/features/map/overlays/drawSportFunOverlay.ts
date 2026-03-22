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

export function drawSportFunOverlay(container: Container, pois: SportFunPoi[]): void {
  const bg = new Graphics();
  container.addChild(bg);
  for (const poi of pois) {
    const { x, y } = poi.position;
    bg.poly(hexPts(x, y, SPORT_FUN_BADGE_R))
      .fill({ color: BADGE_FILL[poi.sportCategory] })
      .stroke({ color: 0x000000, width: 1.5 });
  }
  const sym = new Graphics();
  container.addChild(sym);
  for (const poi of pois) {
    drawIcon(sym, poi.position.x, poi.position.y, poi.sportCategory);
  }
}

function drawIcon(g: Graphics, cx: number, cy: number, cat: SportFunCategory) {
  const W = 0xffffff;
  switch (cat) {
    case "skimovie":
      g.poly([cx - 4, cy - 6, cx + 7, cy, cx - 4, cy + 6]).fill({ color: W });
      break;
    case "speedcheck":
      g.moveTo(cx + 3, cy - 8)
        .lineTo(cx - 2, cy - 1)
        .lineTo(cx + 3, cy - 1)
        .lineTo(cx - 3, cy + 8)
        .stroke({ color: W, width: 2.5, cap: "round", join: "round" });
      break;
    case "skidepot":
      g.moveTo(cx - 5, cy - 7).lineTo(cx + 5, cy + 7)
        .stroke({ color: W, width: 2, cap: "round" });
      g.moveTo(cx + 5, cy - 7).lineTo(cx - 5, cy + 7)
        .stroke({ color: W, width: 2, cap: "round" });
      for (const [dx, dy] of [[-5, -7], [5, -7], [-5, 7], [5, 7]])
        g.circle(cx + dx, cy + dy, 2).fill({ color: W });
      break;
    case "photopoint":
      g.roundRect(cx - 7, cy - 3, 14, 9, 2).stroke({ color: W, width: 1.5 });
      g.circle(cx, cy + 1, 3).stroke({ color: W, width: 1.5 });
      g.roundRect(cx - 5, cy - 6, 4, 3, 1).fill({ color: W });
      break;
    case "viewpoint":
      g.poly([cx - 6, cy + 7, cx - 1, cy - 5, cx + 4, cy + 7]).fill({ color: W, alpha: 0.5 });
      g.poly([cx - 3, cy + 7, cx + 3, cy - 8, cx + 9, cy + 7]).fill({ color: W });
      break;
  }
}
