import type { GastronomySpot, GastronomyType, InfrastructureCategory, InfrastructurePoi, Lift, LiftType, MapLabel, Piste, PisteDifficulty, Point, ResortOverlayData, Webcam, WebcamProvider } from "@/lib/domain/types";

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
  const [rSvgText, lSvgText, dataJson, textSvgText] = await Promise.all([
    fetch("/resorts/zillertal-arena/overlays/R.svg").then((r) => r.text()),
    fetch("/resorts/zillertal-arena/overlays/L.svg").then((r) => r.text()),
    fetch("/resorts/zillertal-arena/overlays/data.json").then((r) => r.json()),
    fetch("/resorts/zillertal-arena/overlays/text.svg").then((r) => r.text()),
  ]);

  const pisteMetaMap = buildPisteMetaMap(dataJson);
  const liftMetaMap = buildLiftMetaMap(dataJson);

  const rDoc = new DOMParser().parseFromString(rSvgText, "image/svg+xml");
  const lDoc = new DOMParser().parseFromString(lSvgText, "image/svg+xml");
  const textDoc = new DOMParser().parseFromString(textSvgText, "image/svg+xml");

  const pistes = parsePistes(rDoc, pisteMetaMap);
  const lifts = parseLifts(lDoc, liftMetaMap);
  const labels = parseLabels(textDoc);
  const gastronomy = parseGastronomy(dataJson);
  const webcams = parseWebcams(dataJson);
  const infrastructure = parseInfrastructure(dataJson);

  return { pistes, lifts, labels, gastronomy, webcams, infrastructure };
}

// ─── metadata ────────────────────────────────────────────────────────────────

type RawPoi = {
  id: string;
  types?: number[];
  position?: { x: number; y: number };
  popup: {
    title: string;
    desc?: string;
    status?: string;
    info?: {
      img?: string;
      imgs?: string[];
      "opening-hours-from"?: string;
      "opening-hours-to"?: string;
    };
  };
  searchdesc?: string;
};

type PisteMeta = { name: string; difficulty: PisteDifficulty; number?: string; lengthM?: number; status?: "open" | "closed" };
type LiftMeta = { name: string; liftType: LiftType; altitudeValley?: number; altitudeMountain?: number; status?: "open" | "closed"; capacity?: number; subtitle?: string; imageUrls?: string[]; description?: string; openingHours?: string };

function buildPisteMetaMap(data: Record<string, unknown>): Map<string, PisteMeta> {
  const map = new Map<string, PisteMeta>();
  const slopes = (data.slopes ?? []) as Array<Record<string, unknown>>;

  for (const slope of slopes) {
    const id = slope.id as string;
    const popup = (slope.popup ?? {}) as Record<string, unknown>;
    const rawDiff = popup.difficulty as string | undefined;
    const difficulty = normalizeDifficulty(rawDiff);
    const name = (popup.title as string | undefined) ?? id;
    const additionalInfo = (popup["additional-info"] ?? {}) as Record<string, unknown>;
    const rawNumber = typeof popup.number === "string"
      ? popup.number
      : typeof popup.number === "number"
      ? String(popup.number)
      : undefined;
    // Prefer the number+letter prefix from the name (e.g. "36a" from "36a Krummbach Gerlos")
    // when the name starts with the same digits as rawNumber.
    const namePrefix = rawNumber ? name.match(/^(\d+[a-zA-Z]?)\s/) : null;
    const number = namePrefix && namePrefix[1].startsWith(rawNumber!) ? namePrefix[1] : rawNumber;
    const lengthM = typeof additionalInfo.length === "number" ? additionalInfo.length : undefined;
    const rawStatus = slope.status as string | undefined;
    const status = rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined;
    map.set(id, { name, difficulty, number, lengthM, status });
  }

  return map;
}

function translateInfrastructureTitle(raw: string): string {
  let s = raw;
  s = s.replace(/^Parkhaus\b/i,          "Car Park");
  s = s.replace(/^Parkplatz\b/i,         "Parking");
  s = s.replace(/^Skibushaltestelle\b/i, "Ski Bus Stop");
  s = s.replace(/^Pistenrettung\b/i,     "Slope Rescue");
  s = s.replace(/^Tourismusverband\b/i,  "Tourist Information Office");
  s = s.replace(/\bGratis-Skibus\b/gi,   "Free Ski Bus");
  return s;
}

function translateInfrastructureDescription(raw: string): string {
  let s = raw;
  s = s.replace(/\bPkw-Parkplätze:/gi, "Car parking spaces:");
  s = s.replace(/\bBus-Parkplätze:/gi, "Bus parking spaces:");
  s = s.replace(
    /Für Gäste mit einem gültigen Skipass ist ein kostenloser Pendel-Busverkehr von allen umliegenden Orten zur Talstation Kreuzjoch und/gi,
    "For guests with a valid ski pass, free shuttle bus service from all surrounding villages to the Kreuzjoch valley station and",
  );
  return s;
}

// Translate German lift description fragments to English.
// Applied to searchdesc at parse time so the UI always shows English.
function translateLiftDescription(raw: string): string {
  let s = raw;

  // ── Lift type prefixes (more specific first) ──────────────────────────────
  s = s.replace(/\b10er Einseilumlaufbahn\b/gi, "10-seat gondola");
  s = s.replace(/\b8er Einseilumlaufbahn\b/gi, "8-seat gondola");
  s = s.replace(/\b8er EUB mit Sitzheizung\b/gi, "8-seat gondola with heated seats");
  s = s.replace(/\b8er EUB\b/gi, "8-seat gondola");
  s = s.replace(/\bKuppelbare (\d+)er-?Sesselbahn mit Wetterschutzhaube\b/gi, "Detachable $1-seat chairlift with weather protection");
  s = s.replace(/\bKuppelbare (\d+)er SB mit Wetterschutzhaube\b/gi, "Detachable $1-seat chairlift with weather protection");
  s = s.replace(/\b(\d+)er Sessellift mit Wetterschutzhaube\b/gi, "$1-seat chairlift with weather protection");
  s = s.replace(/\b(\d+)er Sesselbahn mit Wetterschutzhaube\b/gi, "$1-seat chairlift with weather protection");
  s = s.replace(/\b(\d+)er KSB Sesselbahn\b/gi, "$1-seat chairlift");
  s = s.replace(/\b(\d+) KSB Sesselbahn\b/gi, "$1-seat chairlift");
  s = s.replace(/\b(\d+)er Sesselbahn\b/gi, "$1-seat chairlift");
  s = s.replace(/\b(\d+)er Sessellift\b/gi, "$1-seat chairlift");
  s = s.replace(/\b(\d+)er SB\b/gi, "$1-seat chairlift");
  s = s.replace(/\bmit Sitzheizung\b/gi, "with heated seats");
  s = s.replace(/\bmit Zwischenstation\b/gi, "with intermediate station");

  // ── Key terms ─────────────────────────────────────────────────────────────
  s = s.replace(/\bFahrzeit:/gi, "Journey time:");
  s = s.replace(/\bHöhenunterschied:/gi, "Difference in altitude:");
  s = s.replace(/\bMinuten\b/gi, "min");

  // ── Decimal comma in numeric values (e.g. "3,6 min" → "3.6 min") ─────────
  // Negative lookahead (?!\d\d) prevents replacing thousands separators like "2,000"
  s = s.replace(/(\d),(\d)(?!\d\d)/g, "$1.$2");

  // ── Data typos ────────────────────────────────────────────────────────────
  s = s.replace(/\bDiffernence\b/g, "Difference");

  return s;
}

function buildLiftMetaMap(data: Record<string, unknown>): Map<string, LiftMeta> {
  const map = new Map<string, LiftMeta>();
  const lifts = (data.lifts ?? []) as Array<Record<string, unknown>>;

  for (const lift of lifts) {
    const id = lift.id as string;
    const popup = (lift.popup ?? {}) as Record<string, unknown>;
    const name = (popup.title as string | undefined) ?? id;
    const liftType = normalizeLiftType(lift.type as number);
    const additionalInfo = (popup["additional-info"] ?? {}) as Record<string, unknown>;
    const altitudeValley = typeof additionalInfo["altitude-valley"] === "number" ? additionalInfo["altitude-valley"] : undefined;
    const altitudeMountain = typeof additionalInfo["altitude-mountain"] === "number" ? additionalInfo["altitude-mountain"] : undefined;
    const rawStatus = lift.status as string | undefined;
    const status = rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined;
    const capacity = typeof additionalInfo["capacity"] === "number" ? additionalInfo["capacity"] : undefined;
    const subtitle = typeof lift.subtitle === "string" ? lift.subtitle : undefined;
    const info = (popup.info ?? {}) as Record<string, unknown>;
    const imgs: string[] = Array.isArray(info.imgs) ? info.imgs as string[] : [];
    const single = typeof info.img === "string" ? info.img : undefined;
    const imageUrls = imgs.length > 0 ? imgs : single ? [single] : undefined;
    const description = typeof lift.searchdesc === "string" ? translateLiftDescription(lift.searchdesc) : undefined;
    const rawFrom = info["opening-hours-from"];
    const rawTo = info["opening-hours-to"];
    const openingHours = rawFrom && rawTo ? `${rawFrom} – ${rawTo}` : undefined;
    map.set(id, { name, liftType, altitudeValley, altitudeMountain, status, capacity, subtitle, imageUrls, description, openingHours });
  }

  return map;
}

function parseGastronomy(data: Record<string, unknown>): GastronomySpot[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const items = (pois["202"] ?? []) as RawPoi[];
  return items
    .filter(item => item.position)
    .map(item => {
      const types: number[] = item.types ?? [];
      const type: GastronomyType =
        types.includes(141) ? "bar" :
        types.includes(142) ? "cafe" : "restaurant";
      const info = item.popup.info ?? {};
      const imgs: string[] = Array.isArray((info as Record<string, unknown>).imgs) ? (info as Record<string, unknown>).imgs as string[] : [];
      const single = typeof info.img === "string" ? info.img : undefined;
      const imageUrls = imgs.length > 0 ? imgs : single ? [single] : undefined;
      const from = info["opening-hours-from"];
      const to = info["opening-hours-to"];
      const openingHours = from && to ? `${from} – ${to}` : undefined;
      return {
        id: item.id,
        name: item.popup.title,
        type,
        position: {
          x: item.position!.x * SVG_TO_WORLD,
          y: item.position!.y * SVG_TO_WORLD,
        },
        description: item.searchdesc ?? undefined,
        imageUrls,
        openingHours,
      };
    });
}

const INFRA_CATEGORY_IDS: Record<string, InfrastructureCategory> = {
  "222": "parking",
  "244": "bus",
  "258": "info",
  "216": "rescue",
};

function parseInfrastructure(data: Record<string, unknown>): InfrastructurePoi[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const result: InfrastructurePoi[] = [];
  for (const [catId, category] of Object.entries(INFRA_CATEGORY_IDS)) {
    const items = (pois[catId] ?? []) as RawPoi[];
    for (const item of items) {
      if (!item.position) continue;
      const info = item.popup.info ?? {};
      const imgs: string[] = Array.isArray((info as Record<string, unknown>).imgs)
        ? (info as Record<string, unknown>).imgs as string[]
        : [];
      const single = typeof info.img === "string" ? info.img : undefined;
      const imageUrls = imgs.length > 0 ? imgs : single ? [single] : undefined;
      const from = info["opening-hours-from"];
      const to = info["opening-hours-to"];
      const openingHours = from && to ? `${from} – ${to}` : undefined;
      const rawStatus = item.popup.status;
      const status = rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined;
      result.push({
        id: item.id,
        name: translateInfrastructureTitle(item.popup.title),
        category,
        position: {
          x: item.position.x * SVG_TO_WORLD,
          y: item.position.y * SVG_TO_WORLD,
        },
        description: item.searchdesc ? translateInfrastructureDescription(item.searchdesc) : undefined,
        status,
        openingHours,
        imageUrls,
      });
    }
  }
  return result;
}

function parseWebcams(data: Record<string, unknown>): Webcam[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const feratel = (pois["2816"] ?? []) as RawPoi[];
  const panomax = (pois["2807"] ?? []) as RawPoi[];
  return [...feratel, ...panomax]
    .filter(item => item.position)
    .map(item => {
      const types: number[] = item.types ?? [];
      const provider: WebcamProvider = types.includes(558) ? "panomax" : "feratel";
      const thumbnailUrl = typeof item.popup.info?.img === "string" ? item.popup.info.img : undefined;
      const streamUrl = typeof item.popup.desc === "string" ? item.popup.desc : "";
      return {
        id: item.id,
        name: item.popup.title,
        provider,
        position: { x: item.position!.x * SVG_TO_WORLD, y: item.position!.y * SVG_TO_WORLD },
        thumbnailUrl,
        streamUrl,
      };
    });
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
    const skiRouteSegments: Point[][] = [];

    for (const pathEl of Array.from(pathGroup.querySelectorAll("path"))) {
      const d = pathEl.getAttribute("d");

      if (!d) {
        continue;
      }

      const parsed = parseSvgPathD(d, SVG_TO_WORLD);
      if (pathEl.getAttribute("stroke-dasharray")) {
        skiRouteSegments.push(...parsed);
      } else {
        segments.push(...parsed);
      }
    }

    if (segments.length === 0 && skiRouteSegments.length === 0) {
      continue;
    }

    const iconGroup = group.querySelector(`g[id="${featureId}_icon"]`);
    const icons: Point[] = [];
    for (const circle of Array.from(iconGroup?.querySelectorAll("circle") ?? [])) {
      const cx = parseFloat(circle.getAttribute("cx") ?? "");
      const cy = parseFloat(circle.getAttribute("cy") ?? "");
      if (!isNaN(cx) && !isNaN(cy)) icons.push({ x: cx * SVG_TO_WORLD, y: cy * SVG_TO_WORLD });
    }

    const m = meta.get(featureId);
    pistes.push({
      id: featureId,
      name: m?.name ?? featureId,
      difficulty: m?.difficulty ?? "unknown",
      segments,
      ...(skiRouteSegments.length > 0 ? { skiRouteSegments } : {}),
      ...(icons.length > 0 ? { icons } : {}),
      number: m?.number,
      lengthM: m?.lengthM,
      status: m?.status,
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

    const iconGroup = group.querySelector(`g[id="${featureId}_icon"]`);
    const iconCircle = iconGroup?.querySelector('circle.icon') ?? iconGroup?.querySelector('circle[class="icon"]');
    let icon: Point | undefined;

    if (iconCircle) {
      const cx = parseFloat(iconCircle.getAttribute("cx") ?? "0");
      const cy = parseFloat(iconCircle.getAttribute("cy") ?? "0");
      if (!isNaN(cx) && !isNaN(cy)) {
        icon = { x: cx * SVG_TO_WORLD, y: cy * SVG_TO_WORLD };
      }
    }

    const m = meta.get(featureId);
    lifts.push({
      id: featureId,
      name: m?.name ?? featureId,
      liftType: m?.liftType ?? "other",
      segments,
      icon,
      altitudeValley: m?.altitudeValley,
      altitudeMountain: m?.altitudeMountain,
      status: m?.status,
      capacity: m?.capacity,
      subtitle: m?.subtitle,
      imageUrls: m?.imageUrls,
      description: m?.description,
      openingHours: m?.openingHours,
    });
  }

  return lifts;
}

// ─── label parsing ────────────────────────────────────────────────────────────

function parseHexColor(fill: string | null): number | undefined {
  if (!fill || !fill.startsWith("#")) {
    return undefined;
  }

  return parseInt(fill.slice(1), 16);
}

function parseLabels(doc: Document): MapLabel[] {
  const labels: MapLabel[] = [];

  // Find the text group — try txt_group_1 first, fall back to any <g> containing <text>
  const group =
    doc.getElementById("txt_group_1") ??
    doc.querySelector("g");

  if (!group) {
    return labels;
  }

  // Build background rects from polygons
  type BgRect = { color: number; x: number; y: number; w: number; h: number };
  const bgRects: BgRect[] = [];

  for (const poly of Array.from(group.querySelectorAll("polygon"))) {
    const pointsAttr = poly.getAttribute("points");
    const fillAttr = poly.getAttribute("fill") ?? poly.getAttribute("style");

    if (!pointsAttr) {
      continue;
    }

    // Extract hex color from fill or style attribute
    let hexFill: string | null = null;

    if (fillAttr && fillAttr.startsWith("#")) {
      hexFill = fillAttr;
    } else if (fillAttr && fillAttr.includes("fill:")) {
      const match = /fill:\s*(#[0-9a-fA-F]+)/.exec(fillAttr);
      hexFill = match ? match[1] : null;
    } else {
      hexFill = poly.getAttribute("fill");
    }

    const color = parseHexColor(hexFill);

    if (color === undefined) {
      continue;
    }

    const coords = pointsAttr.trim().split(/[\s,]+/);
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i + 1 < coords.length; i += 2) {
      const px = parseFloat(coords[i]);
      const py = parseFloat(coords[i + 1]);

      if (!isNaN(px) && !isNaN(py)) {
        xs.push(px);
        ys.push(py);
      }
    }

    if (xs.length === 0) {
      continue;
    }

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    bgRects.push({
      color,
      x: minX * SVG_TO_WORLD,
      y: minY * SVG_TO_WORLD,
      w: (maxX - minX) * SVG_TO_WORLD,
      h: (maxY - minY) * SVG_TO_WORLD,
    });
  }

  // Parse text elements
  for (const el of Array.from(group.querySelectorAll("text"))) {
    const text = el.textContent?.trim() ?? "";

    if (!text) {
      continue;
    }

    const x = parseFloat(el.getAttribute("x") ?? "0") * SVG_TO_WORLD;
    const y = parseFloat(el.getAttribute("y") ?? "0") * SVG_TO_WORLD;

    const styleAttr = el.getAttribute("style") ?? "";
    const fillAttr = el.getAttribute("fill");

    // Parse font-size from style or attribute
    let svgFontSize = 7;
    const fsMatch = /font-size:\s*([\d.]+)px/.exec(styleAttr) ?? /font-size:\s*([\d.]+)/.exec(styleAttr);

    if (fsMatch) {
      svgFontSize = parseFloat(fsMatch[1]);
    } else {
      const fsAttr = el.getAttribute("font-size");

      if (fsAttr) {
        svgFontSize = parseFloat(fsAttr);
      }
    }

    const fontSize = svgFontSize * SVG_TO_WORLD;

    // Parse font-weight
    let fontWeight: "bold" | "normal" = "normal";
    const fwMatch = /font-weight:\s*(\w+)/.exec(styleAttr);

    if (fwMatch) {
      fontWeight = fwMatch[1] === "bold" ? "bold" : "normal";
    } else {
      const fwAttr = el.getAttribute("font-weight");

      if (fwAttr === "bold") {
        fontWeight = "bold";
      }
    }

    // Parse fill color
    let colorHex: string | null = null;
    const fillMatch = /fill:\s*(#[0-9a-fA-F]+)/.exec(styleAttr);

    if (fillMatch) {
      colorHex = fillMatch[1];
    } else if (fillAttr) {
      colorHex = fillAttr;
    }

    const color = parseHexColor(colorHex) ?? 0x000000;

    // Find a background rect that contains this text's anchor point
    const matchingBg = bgRects.find(
      (bg) => x >= bg.x && x <= bg.x + bg.w && y >= bg.y && y <= bg.y + bg.h,
    );

    // Tier by SVG font size:
    //   7px bold (badged towns/areas) → 1  always visible
    //   8px bold (major peaks)        → 2  moderate zoom
    //   6px bold (secondary peaks)    → 3  closer zoom
    //   5px normal (direction signs)  → 4  high zoom only
    const tier: 1 | 2 | 3 | 4 =
      svgFontSize === 7 ? 1
      : svgFontSize >= 8 ? 2
      : svgFontSize >= 6 ? 3
      : 4;

    labels.push({
      text,
      x,
      y,
      fontSize,
      color,
      fontWeight,
      tier,
      ...(matchingBg
        ? { bgColor: matchingBg.color, bgX: matchingBg.x, bgY: matchingBg.y, bgW: matchingBg.w, bgH: matchingBg.h }
        : {}),
    });
  }

  return labels;
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
