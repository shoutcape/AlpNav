import { Graphics } from "pixi.js";
import type { Piste, Lift, GastronomySpot, Webcam, InfrastructurePoi, SportFunPoi, PisteDifficulty, Point } from "@/lib/domain/types";
import { SPORT_FUN_BADGE_R } from "./drawSportFunOverlay";

const LIFT_BADGE_R = 24;
const PISTE_BADGE_R = 14;
const GASTRO_BADGE_R = 18;
const INFRA_BADGE_SIZE = 32;
const INFRA_BADGE_CORNER = 4;

const HIGHLIGHT_GOLD = 0xffd700;

const HIGHLIGHT_PISTE_COLORS: Record<PisteDifficulty, number> = {
  easy:      0x4da6ff,
  medium:    0xff5c5c,
  difficult: 0x555555,
  unknown:   0xbdbdbd,
};

const DASH_LEN = 8;
const GAP_LEN = 6;

function hexPts(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + i * (Math.PI / 3);
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

function drawDashedSegment(g: Graphics, seg: Point[], visualScale: number): void {
  let drawing = true;
  const dashLen = DASH_LEN * visualScale;
  const gapLen = GAP_LEN * visualScale;
  let remaining = dashLen;

  for (let i = 1; i < seg.length; i++) {
    let x0 = seg[i - 1].x;
    let y0 = seg[i - 1].y;
    const x1 = seg[i].x;
    const y1 = seg[i].y;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    let covered = 0;

    while (covered < segLen) {
      const step = Math.min(remaining, segLen - covered);
      const nx = x0 + ux * step;
      const ny = y0 + uy * step;
      if (drawing) {
        g.moveTo(x0, y0);
        g.lineTo(nx, ny);
      }
      x0 = nx;
      y0 = ny;
      covered += step;
      remaining -= step;
      if (remaining <= 0) {
        drawing = !drawing;
        remaining = drawing ? dashLen : gapLen;
      }
    }
  }
}

// Called with the below-lifts Graphics — pistes only
export function drawPisteHighlight(g: Graphics, item: Piste | null, visualScale: number = 1): void {
  g.clear();
  if (!item) return;

  const outlineColor = HIGHLIGHT_PISTE_COLORS[item.difficulty];
  const skiSegs = item.skiRouteSegments ?? [];

  // Outline pass (drawn first, behind)
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  for (const seg of skiSegs) {
    if (seg.length < 2) continue;
    drawDashedSegment(g, seg, visualScale);
  }
  g.stroke({ width: 5 * visualScale, color: outlineColor });

  // Gold core
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  for (const seg of skiSegs) {
    if (seg.length < 2) continue;
    drawDashedSegment(g, seg, visualScale);
  }
  g.stroke({ width: 3 * visualScale, color: HIGHLIGHT_GOLD });
}

// Called with the above-lifts Graphics — lifts only.
export function drawLiftHighlight(g: Graphics, item: Lift | null, visualScale: number = 1): void {
  g.clear();
  if (!item) return;

  // Inner line in gold — same width 4 as normal inner, overwrites green
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
  }
  g.stroke({ width: 4 * visualScale, color: HIGHLIGHT_GOLD });

  // Terminal circles in gold — same radius 9, overwrites green fill
  const termRadius = 9 * visualScale;
  for (const seg of item.segments) {
    if (seg.length < 2) continue;
    const first = seg[0];
    const last = seg[seg.length - 1];
    for (const pt of [first, last]) {
      g.circle(pt.x, pt.y, termRadius);
      g.fill({ color: HIGHLIGHT_GOLD });
      g.circle(pt.x, pt.y, termRadius);
      g.stroke({ width: 2.5 * visualScale, color: 0x1b5e20 });
    }
  }

}

const WEBCAM_BADGE_R = 18;

// Drawn on a layer above all marker containers — recolors badge outlines to gold.
export function drawBadgeHighlight(g: Graphics, item: Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi | null, visualScale: number = 1): void {
  g.clear();
  if (!item) return;

  if ("streamUrl" in item) {
    // Webcam — squircle outline in gold, matching the badge shape
    const r = WEBCAM_BADGE_R * visualScale;
    g.roundRect(item.position.x - r, item.position.y - r, r * 2, r * 2, 10 * visualScale);
    g.stroke({ color: HIGHLIGHT_GOLD, width: 2 * visualScale });
    return;
  }

  if ("sportCategory" in item) {
    // SportFunPoi — gold border only; fill and icon are on the layer below
    g.poly(hexPts(item.position.x, item.position.y, SPORT_FUN_BADGE_R * visualScale))
      .stroke({ color: HIGHLIGHT_GOLD, width: 2 * visualScale });
    return;
  }

  if ("category" in item) {
    // InfrastructurePoi — square highlight matching the badge shape
    const s = INFRA_BADGE_SIZE * visualScale;
    g.roundRect(item.position.x - s / 2, item.position.y - s / 2, s, s, INFRA_BADGE_CORNER * visualScale);
    g.stroke({ color: HIGHLIGHT_GOLD, width: 1.5 * visualScale });
    return;
  }

  if ("position" in item) {
    // GastronomySpot — recolor the badge outline to gold, same radius and width
    g.circle(item.position.x, item.position.y, GASTRO_BADGE_R * visualScale);
    g.stroke({ color: HIGHLIGHT_GOLD, width: 1.5 * visualScale });
    return;
  }

  if ("difficulty" in item) {
    // Piste — may have multiple icon positions
    for (const { x, y } of item.icons ?? []) {
      g.circle(x, y, PISTE_BADGE_R * visualScale).stroke({ color: HIGHLIGHT_GOLD, width: 2 * visualScale });
    }
  } else {
    // Lift — single icon
    if (item.icon) {
      g.circle(item.icon.x, item.icon.y, LIFT_BADGE_R * visualScale).stroke({ color: HIGHLIGHT_GOLD, width: 2.5 * visualScale });
    }
  }
}
