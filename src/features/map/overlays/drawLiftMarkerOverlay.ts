import { Container, Graphics } from "pixi.js";
import type { Lift, LiftType } from "@/lib/domain/types";

const BADGE_R = 24;
const BADGE_FILL = 0x1a1a2e;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 2;

const WHITE = 0xffffff;
const CABIN_FILL = 0x2c2c50; // slightly lighter than badge — cabin interior

export function drawLiftMarkerOverlay(container: Container, lifts: Lift[]): void {
  // Pass 1 — badge backgrounds
  const bg = new Graphics();
  container.addChild(bg);
  for (const lift of lifts) {
    if (!lift.icon) continue;
    const { x, y } = lift.icon;
    bg.circle(x, y, BADGE_R)
      .fill({ color: BADGE_FILL })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W });
  }

  // Pass 2 — symbols
  const sym = new Graphics();
  container.addChild(sym);
  for (const lift of lifts) {
    if (!lift.icon) continue;
    drawSymbol(sym, lift.liftType, lift.icon.x, lift.icon.y);
  }
}

function drawSymbol(g: Graphics, liftType: LiftType, cx: number, cy: number): void {
  switch (liftType) {
    case "gondola":   drawGondola(g, cx, cy);   break;
    case "chairlift": drawChairlift(g, cx, cy); break;
    case "drag":      drawDragLift(g, cx, cy);  break;
    default:
      g.circle(cx, cy, 4).fill({ color: WHITE });
  }
}

/**
 * Gondola / cable car
 *
 * Faithfully derived from gondola.svg:
 *   — Angled cable across the top (lower-left → upper-right)
 *   — Rectangle grip/clamp at midpoint of cable
 *   — V-shaped twin hangers from grip down to cabin top section
 *   — Flat top section (mounting deck)
 *   — Large rounded-rect main cabin body
 *   — Two rectangular windows
 */
function drawGondola(g: Graphics, cx: number, cy: number): void {
  // Angled cable
  g.moveTo(cx - 13, cy - 5)
    .lineTo(cx + 13, cy - 12)
    .stroke({ color: WHITE, width: 2, cap: "round" });

  // Grip clamp — small rectangle sitting on the cable at its midpoint (~0, -8.5)
  g.roundRect(cx - 3, cy - 11, 6, 3, 1)
    .fill({ color: WHITE });

  // V-shaped twin hangers: from bottom of grip down to top section edges
  g.moveTo(cx - 1.5, cy - 8).lineTo(cx - 5, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });
  g.moveTo(cx + 1.5, cy - 8).lineTo(cx + 5, cy - 3)
    .stroke({ color: WHITE, width: 1.5, cap: "round" });

  // Top mounting deck (flat section between hangers and main cabin)
  g.rect(cx - 8, cy - 3, 16, 3)
    .fill({ color: CABIN_FILL })
    .stroke({ color: WHITE, width: 1.5 });

  // Main cabin body
  g.roundRect(cx - 8, cy, 16, 12, 2)
    .fill({ color: CABIN_FILL })
    .stroke({ color: WHITE, width: 1.5 });

  // Left window
  g.roundRect(cx - 7, cy + 2, 5, 7, 1)
    .stroke({ color: WHITE, width: 1 });

  // Right window
  g.roundRect(cx + 2, cy + 2, 5, 7, 1)
    .stroke({ color: WHITE, width: 1 });
}

/**
 * Chairlift — connection point → drop → angular C-bracket → L-chair → footrest
 */
function drawChairlift(g: Graphics, cx: number, cy: number): void {
  // Diagonal cable
  g.moveTo(cx - 13, cy - 8)
    .lineTo(cx + 13, cy - 12)
    .stroke({ color: WHITE, width: 2, cap: "round" });

  // Connection point on cable
  g.circle(cx, cy - 10, 3).fill({ color: WHITE });

  // Short drop from connection point to top of C-bracket
  g.moveTo(cx, cy - 7)
    .lineTo(cx, cy - 4)
    .stroke({ color: WHITE, width: 2, cap: "round" });

  // Angular C-bracket (opens right, body to the left):
  // top arm goes left → down (longer) → bottom arm goes right, landing at L corner
  g.moveTo(cx, cy - 4)
    .lineTo(cx - 4, cy - 4)  // top arm goes left
    .lineTo(cx - 4, cy + 8)  // left side — extended for lower seat
    .lineTo(cx, cy + 8)      // bottom arm returns right → L corner
    .stroke({ color: WHITE, width: 2, cap: "round", join: "miter" });

  // L-shaped chair: corner at (cx, cy+8) = where C lands
  // Longer backrest extends UP from corner, seat extends RIGHT (uphill)
  g.moveTo(cx, cy + 0)        // free top of backrest
    .lineTo(cx, cy + 8)       // backrest down to corner
    .lineTo(cx + 7, cy + 8)   // seat extends uphill
    .stroke({ color: WHITE, width: 2, cap: "round", join: "round" });

  // Small footrest below seat
  g.moveTo(cx + 1, cy + 11)
    .lineTo(cx + 6, cy + 11)
    .stroke({ color: WHITE, width: 2, cap: "round" });
}

/**
 * Drag lift / anchor lift (T-bar)
 *
 * Derived from anchor_lift.svg:
 *   — Prominent horizontal cable at the very top
 *   — Clamp circle sitting on the cable
 *   — Long vertical pole/hanger
 *   — Wide horizontal T-bar at the bottom
 */
function drawDragLift(g: Graphics, cx: number, cy: number): void {
  // Angled cable — same uphill direction as gondola/chairlift
  g.moveTo(cx - 13, cy - 8)
    .lineTo(cx + 13, cy - 14)
    .stroke({ color: WHITE, width: 2.5, cap: "round" });

  // Clamp circle at cable midpoint (~cy - 11)
  g.circle(cx, cy - 11, 2.5).fill({ color: WHITE });

  // Long vertical hanger pole
  g.moveTo(cx, cy - 8.5)
    .lineTo(cx, cy + 9)
    .stroke({ color: WHITE, width: 2, cap: "round" });

  // T-bar
  g.moveTo(cx - 6, cy + 9)
    .lineTo(cx + 6, cy + 9)
    .stroke({ color: WHITE, width: 2.5, cap: "round" });
}
