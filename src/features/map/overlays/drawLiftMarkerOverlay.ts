import { Container, Graphics } from "pixi.js";
import type { Lift, LiftType } from "@/lib/domain/types";

const BADGE_R = 24;
const BADGE_FILL = 0x66bb6a;
const BADGE_STROKE_COLOR = 0x000000;
const BADGE_STROKE_W = 2;

const WHITE = 0xffffff;
const CABIN_FILL = 0x4a9b4e; // slightly darker than badge — cabin interior

export function drawLiftMarkerOverlay(container: Container, lifts: Lift[], visualScale: number = 1): void {
  // Pass 1 — badge backgrounds
  const bg = new Graphics();
  container.addChild(bg);
  for (const lift of lifts) {
    if (!lift.icon) continue;
    const { x, y } = lift.icon;
    bg.circle(x, y, BADGE_R * visualScale)
      .fill({ color: BADGE_FILL })
      .stroke({ color: BADGE_STROKE_COLOR, width: BADGE_STROKE_W * visualScale });
  }

  // Pass 2 — symbols
  const sym = new Graphics();
  container.addChild(sym);
  for (const lift of lifts) {
    if (!lift.icon) continue;
    drawSymbol(sym, lift.liftType, lift.icon.x, lift.icon.y, visualScale);
  }
}

function drawSymbol(g: Graphics, liftType: LiftType, cx: number, cy: number, s: number): void {
  switch (liftType) {
    case "gondola":   drawGondola(g, cx, cy, s);   break;
    case "chairlift": drawChairlift(g, cx, cy, s); break;
    case "drag":      drawDragLift(g, cx, cy, s);  break;
    default:
      g.circle(cx, cy, 4 * s).fill({ color: WHITE });
  }
}

/**
 * Gondola / cable car
 */
function drawGondola(g: Graphics, cx: number, cy: number, s: number): void {
  // Angled cable
  g.moveTo(cx - 13 * s, cy - 5 * s)
    .lineTo(cx + 13 * s, cy - 12 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });

  // Grip clamp — small rectangle sitting on the cable at its midpoint (~0, -8.5)
  g.roundRect(cx - 3 * s, cy - 11 * s, 6 * s, 3 * s, 1 * s)
    .fill({ color: WHITE });

  // V-shaped twin hangers: from bottom of grip down to top section edges
  g.moveTo(cx - 1.5 * s, cy - 8 * s).lineTo(cx - 5 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });
  g.moveTo(cx + 1.5 * s, cy - 8 * s).lineTo(cx + 5 * s, cy - 3 * s)
    .stroke({ color: WHITE, width: 1.5 * s, cap: "round" });

  // Top mounting deck (flat section between hangers and main cabin)
  g.rect(cx - 8 * s, cy - 3 * s, 16 * s, 3 * s)
    .fill({ color: CABIN_FILL })
    .stroke({ color: WHITE, width: 1.5 * s });

  // Main cabin body
  g.roundRect(cx - 8 * s, cy, 16 * s, 12 * s, 2 * s)
    .fill({ color: CABIN_FILL })
    .stroke({ color: WHITE, width: 1.5 * s });

  // Left window
  g.roundRect(cx - 7 * s, cy + 2 * s, 5 * s, 7 * s, 1 * s)
    .stroke({ color: WHITE, width: 1 * s });

  // Right window
  g.roundRect(cx + 2 * s, cy + 2 * s, 5 * s, 7 * s, 1 * s)
    .stroke({ color: WHITE, width: 1 * s });
}

/**
 * Chairlift — connection point → drop → angular C-bracket → L-chair → footrest
 */
function drawChairlift(g: Graphics, cx: number, cy: number, s: number): void {
  // Diagonal cable
  g.moveTo(cx - 13 * s, cy - 8 * s)
    .lineTo(cx + 13 * s, cy - 12 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });

  // Connection point on cable
  g.circle(cx, cy - 10 * s, 3 * s).fill({ color: WHITE });

  // Short drop from connection point to top of C-bracket
  g.moveTo(cx, cy - 7 * s)
    .lineTo(cx, cy - 4 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });

  // Angular C-bracket (opens right, body to the left):
  // top arm goes left → down (longer) → bottom arm goes right, landing at L corner
  g.moveTo(cx, cy - 4 * s)
    .lineTo(cx - 4 * s, cy - 4 * s)  // top arm goes left
    .lineTo(cx - 4 * s, cy + 8 * s)  // left side — extended for lower seat
    .lineTo(cx, cy + 8 * s)      // bottom arm returns right → L corner
    .stroke({ color: WHITE, width: 2 * s, cap: "round", join: "miter" });

  // L-shaped chair: corner at (cx, cy+8) = where C lands
  // Longer backrest extends UP from corner, seat extends RIGHT (uphill)
  g.moveTo(cx, cy + 0)        // free top of backrest
    .lineTo(cx, cy + 8 * s)       // backrest down to corner
    .lineTo(cx + 7 * s, cy + 8 * s)   // seat extends uphill
    .stroke({ color: WHITE, width: 2 * s, cap: "round", join: "round" });

  // Small footrest below seat
  g.moveTo(cx + 1 * s, cy + 11 * s)
    .lineTo(cx + 6 * s, cy + 11 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });
}

/**
 * Drag lift / anchor lift (T-bar)
 */
function drawDragLift(g: Graphics, cx: number, cy: number, s: number): void {
  // Angled cable — same uphill direction as gondola/chairlift
  g.moveTo(cx - 13 * s, cy - 8 * s)
    .lineTo(cx + 13 * s, cy - 14 * s)
    .stroke({ color: WHITE, width: 2.5 * s, cap: "round" });

  // Clamp circle at cable midpoint (~cy - 11)
  g.circle(cx, cy - 11 * s, 2.5 * s).fill({ color: WHITE });

  // Long vertical hanger pole
  g.moveTo(cx, cy - 8.5 * s)
    .lineTo(cx, cy + 9 * s)
    .stroke({ color: WHITE, width: 2 * s, cap: "round" });

  // T-bar
  g.moveTo(cx - 6 * s, cy + 9 * s)
    .lineTo(cx + 6 * s, cy + 9 * s)
    .stroke({ color: WHITE, width: 2.5 * s, cap: "round" });
}
