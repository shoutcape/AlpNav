import type { Lift, LiftType, Piste, PisteDifficulty, Point, ResortOverlayData } from "@/lib/domain/types";

// SVG viewBox is 0 0 1024 672; PixiJS world is 4096×2688
const SVG_TO_WORLD = 4.0;

let cachedResult: Promise<ResortOverlayData> | null = null;

export function loadArenaOverlayData(): Promise<ResortOverlayData> {
  if (cachedResult === null) {
    cachedResult = fetchAndParse();
  }

  return cachedResult;
}

async function fetchAndParse(): Promise<ResortOverlayData> {
  const [rSvgText, lSvgText, dataJson] = await Promise.all([
    fetch("/resorts/zillertal-arena/overlays/R.svg").then((r) => r.text()),
    fetch("/resorts/zillertal-arena/overlays/L.svg").then((r) => r.text()),
    fetch("/resorts/zillertal-arena/overlays/data.json").then((r) => r.json()),
  ]);

  const pisteMetaMap = buildPisteMetaMap(dataJson);
  const liftMetaMap = buildLiftMetaMap(dataJson);

  const rDoc = new DOMParser().parseFromString(rSvgText, "image/svg+xml");
  const lDoc = new DOMParser().parseFromString(lSvgText, "image/svg+xml");

  const pistes = parsePistes(rDoc, pisteMetaMap);
  const lifts = parseLifts(lDoc, liftMetaMap);

  return { pistes, lifts };
}

// ─── metadata ────────────────────────────────────────────────────────────────

type PisteMeta = { name: string; difficulty: PisteDifficulty };
type LiftMeta = { name: string; liftType: LiftType };

function buildPisteMetaMap(data: Record<string, unknown>): Map<string, PisteMeta> {
  const map = new Map<string, PisteMeta>();
  const slopes = (data.slopes ?? []) as Array<Record<string, unknown>>;

  for (const slope of slopes) {
    const id = slope.id as string;
    const popup = (slope.popup ?? {}) as Record<string, unknown>;
    const rawDiff = popup.difficulty as string | undefined;
    const difficulty = normalizeDifficulty(rawDiff);
    const name = (popup.title as string | undefined) ?? id;
    map.set(id, { name, difficulty });
  }

  return map;
}

function buildLiftMetaMap(data: Record<string, unknown>): Map<string, LiftMeta> {
  const map = new Map<string, LiftMeta>();
  const lifts = (data.lifts ?? []) as Array<Record<string, unknown>>;

  for (const lift of lifts) {
    const id = lift.id as string;
    const popup = (lift.popup ?? {}) as Record<string, unknown>;
    const name = (popup.title as string | undefined) ?? id;
    const liftType = normalizeLiftType(lift.type as number);
    map.set(id, { name, liftType });
  }

  return map;
}

function normalizeDifficulty(raw: string | undefined): PisteDifficulty {
  switch (raw) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "difficult":
      return "difficult";
    default:
      return "unknown";
  }
}

function normalizeLiftType(type: number): LiftType {
  // From data.json translations: 1=8p chairlift, 2=aerial tramway, 9=button lift,
  // 13=2p chairlift, 21=magic carpet, 23=monocable gondola, 25=4p chairlift,
  // 30=6p chairlift, 31=T-bar
  switch (type) {
    case 2:
    case 3:
    case 7:
    case 8:
    case 17:
    case 23:
      return "gondola";
    case 1:
    case 13:
    case 24:
    case 25:
    case 29:
    case 30:
    case 33:
      return "chairlift";
    case 9:
    case 21:
    case 31:
      return "drag";
    default:
      return "other";
  }
}

// ─── piste parsing ────────────────────────────────────────────────────────────

function parsePistes(doc: Document, meta: Map<string, PisteMeta>): Piste[] {
  const pistes: Piste[] = [];
  // Match only primary groups (R_{oid}_group), not suffix variants like R_{oid}_at_group
  const groupPattern = /^R_(\d+)_group$/;

  for (const group of Array.from(doc.querySelectorAll("g[id]"))) {
    const id = group.getAttribute("id") ?? "";
    const match = groupPattern.exec(id);

    if (!match) {
      continue;
    }

    const oid = match[1];
    const featureId = `R_${oid}`;

    const pathGroup = group.querySelector(`g[id="${featureId}_path"]`);

    if (!pathGroup) {
      continue;
    }

    const segments: Point[][] = [];

    for (const pathEl of Array.from(pathGroup.querySelectorAll("path"))) {
      const d = pathEl.getAttribute("d");

      if (!d) {
        continue;
      }

      const parsed = parseSvgPathD(d, SVG_TO_WORLD);
      segments.push(...parsed);
    }

    if (segments.length === 0) {
      continue;
    }

    const m = meta.get(featureId);
    pistes.push({
      id: featureId,
      name: m?.name ?? featureId,
      difficulty: m?.difficulty ?? "unknown",
      segments,
    });
  }

  return pistes;
}

// ─── lift parsing ─────────────────────────────────────────────────────────────

function parseLifts(doc: Document, meta: Map<string, LiftMeta>): Lift[] {
  const lifts: Lift[] = [];
  const groupPattern = /^L_(\d+)_group$/;

  for (const group of Array.from(doc.querySelectorAll("g[id]"))) {
    const id = group.getAttribute("id") ?? "";
    const match = groupPattern.exec(id);

    if (!match) {
      continue;
    }

    const oid = match[1];
    const featureId = `L_${oid}`;

    // Prefer _path sub-group; skip _background to avoid duplicate geometry
    const pathGroup =
      group.querySelector(`g[id="${featureId}_path"]`) ??
      group;

    const segments: Point[][] = [];

    for (const polyEl of Array.from(pathGroup.querySelectorAll("polyline"))) {
      const points = polyEl.getAttribute("points");

      if (!points) {
        continue;
      }

      const seg = parsePolylinePoints(points, SVG_TO_WORLD);

      if (seg.length > 0) {
        segments.push(seg);
      }
    }

    if (segments.length === 0) {
      continue;
    }

    const m = meta.get(featureId);
    lifts.push({
      id: featureId,
      name: m?.name ?? featureId,
      liftType: m?.liftType ?? "other",
      segments,
    });
  }

  return lifts;
}

function parsePolylinePoints(points: string, scale: number): Point[] {
  const pairs = points.trim().split(/[\s,]+/);
  const result: Point[] = [];

  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const x = parseFloat(pairs[i]);
    const y = parseFloat(pairs[i + 1]);

    if (!isNaN(x) && !isNaN(y)) {
      result.push({ x: x * scale, y: y * scale });
    }
  }

  return result;
}

// ─── SVG path parser ──────────────────────────────────────────────────────────

function parseSvgPathD(d: string, scale: number): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];

  let cx = 0;
  let cy = 0;
  // Previous cubic bezier second control point (for 's' smooth cubic)
  let prevCp2x = 0;
  let prevCp2y = 0;
  let lastCmd = "";

  // Tokenize: pull out each command letter and the following numbers
  const tokenRe = /([MmCcSsLlHhVvAaTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;

  const tokens: Array<{ cmd?: string; num?: number }> = [];
  let tok: RegExpExecArray | null;

  while ((tok = tokenRe.exec(d)) !== null) {
    if (tok[1]) {
      tokens.push({ cmd: tok[1] });
    } else if (tok[2]) {
      tokens.push({ num: parseFloat(tok[2]) });
    }
  }

  let i = 0;

  const nextNum = (): number => {
    while (i < tokens.length && tokens[i].cmd !== undefined) {
      i++;
    }

    return i < tokens.length ? (tokens[i++].num ?? 0) : 0;
  };

  const pushPoint = (px: number, py: number) => {
    current.push({ x: px * scale, y: py * scale });
  };

  const startSegment = (px: number, py: number) => {
    if (current.length > 0) {
      segments.push(current);
    }

    current = [];
    cx = px;
    cy = py;
    pushPoint(cx, cy);
  };

  while (i < tokens.length) {
    if (tokens[i].cmd !== undefined) {
      const cmd = tokens[i].cmd!;
      i++;

      // Re-apply command if followed directly by numbers (implicit repetition)
      let repeating = true;

      while (repeating) {
        // Check if there are more numbers or another command next
        const hasMore = i < tokens.length && tokens[i].num !== undefined;

        if (!hasMore && cmd !== "Z" && cmd !== "z") {
          break;
        }

        switch (cmd) {
          case "M": {
            const mx = nextNum();
            const my = nextNum();
            startSegment(mx, my);
            lastCmd = "M";
            // Implicit lineto for subsequent coord pairs
            while (i < tokens.length && tokens[i].num !== undefined) {
              const lx = nextNum();
              const ly = nextNum();
              cx = lx;
              cy = ly;
              pushPoint(cx, cy);
            }

            repeating = false;
            break;
          }

          case "m": {
            const dx = nextNum();
            const dy = nextNum();
            startSegment(cx + dx, cy + dy);
            lastCmd = "m";
            while (i < tokens.length && tokens[i].num !== undefined) {
              const ldx = nextNum();
              const ldy = nextNum();
              cx += ldx;
              cy += ldy;
              pushPoint(cx, cy);
            }

            repeating = false;
            break;
          }

          case "c": {
            // relative cubic bezier: dx1 dy1 dx2 dy2 dx dy
            while (i < tokens.length && tokens[i].num !== undefined) {
              const dx1 = nextNum();
              const dy1 = nextNum();
              const dx2 = nextNum();
              const dy2 = nextNum();
              const dx = nextNum();
              const dy = nextNum();
              prevCp2x = cx + dx2;
              prevCp2y = cy + dy2;
              sampleCubic(cx, cy, cx + dx1, cy + dy1, prevCp2x, prevCp2y, cx + dx, cy + dy, current, scale);
              cx += dx;
              cy += dy;
            }

            lastCmd = "c";
            repeating = false;
            break;
          }

          case "C": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              const x1 = nextNum();
              const y1 = nextNum();
              const x2 = nextNum();
              const y2 = nextNum();
              const x = nextNum();
              const y = nextNum();
              prevCp2x = x2;
              prevCp2y = y2;
              sampleCubic(cx, cy, x1, y1, prevCp2x, prevCp2y, x, y, current, scale);
              cx = x;
              cy = y;
            }

            lastCmd = "C";
            repeating = false;
            break;
          }

          case "s": {
            // relative smooth cubic: dx2 dy2 dx dy
            while (i < tokens.length && tokens[i].num !== undefined) {
              const dx2 = nextNum();
              const dy2 = nextNum();
              const dx = nextNum();
              const dy = nextNum();
              // P1 = reflection of prev P2 through current point
              const implicitCp1x = lastCmd === "c" || lastCmd === "C" || lastCmd === "s" || lastCmd === "S"
                ? 2 * cx - prevCp2x
                : cx;
              const implicitCp1y = lastCmd === "c" || lastCmd === "C" || lastCmd === "s" || lastCmd === "S"
                ? 2 * cy - prevCp2y
                : cy;
              prevCp2x = cx + dx2;
              prevCp2y = cy + dy2;
              sampleCubic(cx, cy, implicitCp1x, implicitCp1y, prevCp2x, prevCp2y, cx + dx, cy + dy, current, scale);
              cx += dx;
              cy += dy;
            }

            lastCmd = "s";
            repeating = false;
            break;
          }

          case "l": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum();
              cy += nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "l";
            repeating = false;
            break;
          }

          case "L": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx = nextNum();
              cy = nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "L";
            repeating = false;
            break;
          }

          case "h": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "h";
            repeating = false;
            break;
          }

          case "H": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx = nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "H";
            repeating = false;
            break;
          }

          case "v": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cy += nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "v";
            repeating = false;
            break;
          }

          case "V": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cy = nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "V";
            repeating = false;
            break;
          }

          case "a": {
            // relative arc: rx ry x-rotation large-arc-flag sweep-flag dx dy
            // Approximate as line to endpoint
            while (i < tokens.length && tokens[i].num !== undefined) {
              nextNum(); // rx
              nextNum(); // ry
              nextNum(); // x-rotation
              nextNum(); // large-arc-flag
              nextNum(); // sweep-flag
              cx += nextNum();
              cy += nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "a";
            repeating = false;
            break;
          }

          case "A": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              nextNum();
              nextNum();
              nextNum();
              nextNum();
              nextNum();
              cx = nextNum();
              cy = nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "A";
            repeating = false;
            break;
          }

          case "t": {
            // relative smooth quadratic bezier: dx dy — treat as lineto
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum();
              cy += nextNum();
              pushPoint(cx, cy);
            }

            lastCmd = "t";
            repeating = false;
            break;
          }

          case "Z":
          case "z": {
            lastCmd = cmd;
            repeating = false;
            break;
          }

          default:
            repeating = false;
        }
      }
    } else {
      // Bare number with no command (shouldn't happen in well-formed SVG, skip)
      i++;
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}

// Sample a cubic bezier B(t) at BEZIER_STEPS steps and append to polyline
const BEZIER_STEPS = 10;

function sampleCubic(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  out: Point[],
  scale: number,
) {
  // Start from t=1/BEZIER_STEPS so we don't duplicate the moveto point
  for (let step = 1; step <= BEZIER_STEPS; step++) {
    const t = step / BEZIER_STEPS;
    const mt = 1 - t;
    const x = mt * mt * mt * p0x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * p3x;
    const y = mt * mt * mt * p0y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * p3y;
    out.push({ x: x * scale, y: y * scale });
  }
}
