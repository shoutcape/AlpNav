import type { GastronomySpot, GastronomyType, InfrastructureCategory, InfrastructurePoi, Lift, LiftType, MapLabel, Piste, PisteDifficulty, Point, ResortOverlayData, SportFunCategory, SportFunPoi, Webcam, WebcamProvider } from "@/lib/domain/types";

// The scale factor is dynamically calculated based on the panorama manifest and SVG width.

export async function loadIntermapsOverlayData(resortId: string): Promise<ResortOverlayData> {
  const [rSvgText, lSvgText, dataJson, textSvgText, manifestJson] = await Promise.all([
    fetch(`/resorts/${resortId}/overlays/R.svg`).then((r) => r.text()),
    fetch(`/resorts/${resortId}/overlays/L.svg`).then((r) => r.text()),
    fetch(`/resorts/${resortId}/overlays/data.json`).then((r) => r.json()),
    fetch(`/resorts/${resortId}/overlays/text.svg`).then((r) => r.text()),
    fetch(`/resorts/${resortId}/panorama/manifest.json`).then((r) => r.json()),
  ]);

  const rDoc = new DOMParser().parseFromString(rSvgText, "image/svg+xml");
  const lDoc = new DOMParser().parseFromString(lSvgText, "image/svg+xml");
  const textDoc = new DOMParser().parseFromString(textSvgText, "image/svg+xml");

  const viewBoxAttr = rDoc.documentElement.getAttribute("viewBox");
  let svgWidth = 1024;
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/\s+/);
    if (parts.length === 4) svgWidth = parseFloat(parts[2]);
  } else {
    svgWidth = parseFloat(rDoc.documentElement.getAttribute("width") || "1024");
  }
  const maxLevel = manifestJson.levels[manifestJson.levels.length - 1];
  const scale = maxLevel.width / svgWidth;

  const pisteMetaMap = buildPisteMetaMap(dataJson);
  const liftMetaMap = buildLiftMetaMap(dataJson);

  const pistes = parsePistes(rDoc, pisteMetaMap, scale);
  const lifts = parseLifts(lDoc, liftMetaMap, scale);
  const labels = parseLabels(textDoc, scale);
  const gastronomy = parseGastronomy(dataJson, scale);
  const webcams = parseWebcams(dataJson, scale);
  const infrastructure = parseInfrastructure(dataJson, scale);
  const sportFun = parseSportFun(dataJson, scale);

  return { pistes, lifts, labels, gastronomy, webcams, infrastructure, sportFun };
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
      website?: string;
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
    const subtitle = typeof popup.subtitle === "string" ? popup.subtitle : undefined;
    const difficulty = normalizeDifficulty(rawDiff, subtitle);
    const name = (popup.title as string | undefined) ?? id;
    const additionalInfo = (popup["additional-info"] ?? {}) as Record<string, unknown>;
    const rawNumber = typeof popup.number === "string"
      ? popup.number
      : typeof popup.number === "number"
      ? String(popup.number)
      : undefined;

    const suspiciousLongNumber = typeof rawNumber === "string" && /^\d{5,}$/.test(rawNumber);
    let number = rawNumber;
    const namePrefixMatch = name.match(/^(\d+[a-zA-Z]?)(\s|$)/);
    if (namePrefixMatch) {
      if (!rawNumber || suspiciousLongNumber || namePrefixMatch[1].startsWith(rawNumber)) {
        number = namePrefixMatch[1];
      }
    }
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

function translateSportFunTitle(raw: string, cat: SportFunCategory): string {
  if (cat === "viewpoint") return raw.replace(/^Photopoint\b/i, "Viewpoint");
  return raw
    .replace(/^SkiMovie\s+Strecke\b/i, "SkiMovie Station")
    .replace(/^SkiMovie\b/i, "SkiMovie Station")
    .replace(/^Speed\s*Check\b/i, "Speed Check")
    .replace(/^Skidepot\b/i, "Ski Depot")
    .replace(/^Photopoint\b/i, "Photo Point");
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
    const subtitle = typeof lift.subtitle === "string" ? lift.subtitle : undefined;
    const liftType = normalizeLiftType(lift.type as number, subtitle);
    const additionalInfo = (popup["additional-info"] ?? {}) as Record<string, unknown>;
    const altitudeValley = typeof additionalInfo["altitude-valley"] === "number" ? additionalInfo["altitude-valley"] : undefined;
    const altitudeMountain = typeof additionalInfo["altitude-mountain"] === "number" ? additionalInfo["altitude-mountain"] : undefined;
    const rawStatus = lift.status as string | undefined;
    const status = rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined;
    const capacity = typeof additionalInfo["capacity"] === "number" ? additionalInfo["capacity"] : undefined;
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

function parseGastronomy(data: Record<string, unknown>, scale: number): GastronomySpot[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const items202 = (pois["202"] ?? []) as RawPoi[];
  const items3001 = (pois["3001"] ?? []) as RawPoi[];
  const items3002 = (pois["3002"] ?? []) as RawPoi[];
  
  const allItems = [
    ...items202.map(item => ({ item, defaultType: "restaurant" as GastronomyType })),
    ...items3001.map(item => ({ item, defaultType: "restaurant" as GastronomyType })),
    ...items3002.map(item => ({ item, defaultType: "bar" as GastronomyType })),
  ];

  return allItems
    .filter(({ item }) => item.position)
    .map(({ item, defaultType }) => {
      const types: number[] = item.types ?? [];
      let type: GastronomyType = defaultType;
      // Override default if explicit types exist (mostly for 202)
      if (types.includes(141)) type = "bar";
      else if (types.includes(142)) type = "cafe";

      const info = item.popup.info ?? {};
      const imgs: string[] = Array.isArray((info as Record<string, unknown>).imgs) ? (info as Record<string, unknown>).imgs as string[] : [];
      const single = typeof info.img === "string" ? info.img : undefined;
      const imageUrls = imgs.length > 0 ? imgs : single ? [single] : undefined;
      const from = info["opening-hours-from"];
      const to = info["opening-hours-to"];
      const openingHours = from && to ? `${from} – ${to}` : undefined;
      const website = typeof info.website === "string" ? info.website : undefined;
      return {
        id: item.id,
        name: item.popup.title,
        type,
        position: {
          x: item.position!.x * scale,
          y: item.position!.y * scale,
        },
        description: item.searchdesc ?? undefined,
        imageUrls,
        openingHours,
        website,
      };
    });
}

const INFRA_CATEGORY_IDS: Record<string, InfrastructureCategory> = {
  "222": "parking", "3201": "parking",
  "244": "bus", "3206": "bus",
  "258": "info", "3202": "info", "3203": "info",
  "216": "rescue",
};

function parseInfrastructure(data: Record<string, unknown>, scale: number): InfrastructurePoi[] {
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
          x: item.position.x * scale,
          y: item.position.y * scale,
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

const SPORT_FUN_CATEGORY_IDS: Record<string, SportFunCategory> = {
  "247": "skimovie", "3416": "skimovie",
  "256": "speedcheck",
  "242": "skidepot", "3219": "skidepot",
  "226": "photopoint",
  "261": "viewpoint", "3216": "viewpoint",
};

function parseSportFun(data: Record<string, unknown>, scale: number): SportFunPoi[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const result: SportFunPoi[] = [];
  for (const [catId, sportCategory] of Object.entries(SPORT_FUN_CATEGORY_IDS)) {
    const items = (pois[catId] ?? []) as RawPoi[];
    for (const item of items) {
      if (!item.position) continue;
      const info = (item.popup.info ?? {}) as Record<string, unknown>;
      const imgs = Array.isArray(info.imgs) ? (info.imgs as string[]) : [];
      const single = typeof info.img === "string" ? info.img : undefined;
      const imageUrls = imgs.length > 0 ? imgs : single ? [single] : undefined;
      const rawStatus = item.popup.status;
      result.push({
        id: item.id,
        name: translateSportFunTitle(item.popup.title, sportCategory),
        sportCategory,
        position: { x: item.position.x * scale, y: item.position.y * scale },
        description: item.searchdesc ?? undefined,
        status: rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined,
        imageUrls,
      });
    }
  }
  return result;
}

function parseWebcams(data: Record<string, unknown>, scale: number): Webcam[] {
  const pois = (data.pois ?? {}) as Record<string, unknown>;
  const feratel = [...(pois["2816"] ?? []) as RawPoi[], ...(pois["2810"] ?? []) as RawPoi[], ...(pois["2809"] ?? []) as RawPoi[]].map(item => ({ ...item, _provider: "feratel" }));
  const panomax = ((pois["2807"] ?? []) as RawPoi[]).map(item => ({ ...item, _provider: "panomax" }));

  return [...feratel, ...panomax]
    .filter(item => item.position)
    .map(item => {
      const types: number[] = item.types ?? [];
      const provider: WebcamProvider = (item as Record<string, unknown>)._provider as WebcamProvider ?? (types.includes(558) ? "panomax" : "feratel");
      const popup = item.popup as Record<string, unknown>;
      const popupInfo = popup.info as Record<string, unknown> | undefined;
      const thumbnailUrl = typeof popupInfo?.img === "string" ? popupInfo.img : (typeof popup.thumbnail === "string" ? popup.thumbnail : undefined);
      const streamUrl = typeof popup.desc === "string" ? popup.desc : "";

      return {
        id: item.id as string,
        name: popup.title as string,
        provider,
        position: { x: item.position!.x * scale, y: item.position!.y * scale },
        thumbnailUrl,
        streamUrl,
      };
    });
}

function normalizeDifficulty(rawDiff: string | undefined, subtitle: string | undefined): PisteDifficulty {
  if (rawDiff) {
    switch (rawDiff.toLowerCase()) {
      case "easy":
        return "easy";
      case "medium":
        return "medium";
      case "difficult":
        return "difficult";
    }
  }

  if (subtitle) {
    const s = subtitle.toLowerCase();
    if (s.includes("easy")) return "easy";
    if (s.includes("medium") || s.includes("intermediate")) return "medium";
    if (s.includes("difficult")) return "difficult";
  }

  return "unknown";
}

function normalizeLiftType(type: number, subtitle?: string): LiftType {
  switch (type) {
    case 2: case 3: case 7: case 8: case 17: case 23:
    case 2608: case 2623: case 2624: case 2634:
      return "gondola";
    case 1: case 13: case 24: case 25: case 29: case 30: case 33:
    case 2604: case 2605: case 2606:
      return "chairlift";
    case 9: case 21: case 31:
    case 2607: case 2610: case 2613:
      return "drag";
  }

  if (subtitle) {
    const s = subtitle.toLowerCase();
    if (s.includes("gondola") || s.includes("cable car") || s.includes("tramway") || s.includes("umlaufbahn") || s.includes("kombibahn")) return "gondola";
    if (s.includes("chair")) return "chairlift";
    if (s.includes("t-bar") || s.includes("drag") || s.includes("tow") || s.includes("carpet") || s.includes("teller") || s.includes("kuli")) return "drag";
  }

  return "other";
}

// ─── piste parsing ────────────────────────────────────────────────────────────

function parsePistes(doc: Document, meta: Map<string, PisteMeta>, scale: number): Piste[] {
  const pistes: Piste[] = [];
  const groupPattern = /^R_(\d+)_group$/;

  for (const group of Array.from(doc.querySelectorAll("g[id]"))) {
    const id = group.getAttribute("id") ?? "";
    const match = groupPattern.exec(id);

    if (!match) continue;

    const oid = match[1];
    const featureId = `R_${oid}`;
    const pathGroup = group.querySelector(`g[id="${featureId}_path"]`);

    if (!pathGroup) continue;

    const segments: Point[][] = [];
    const skiRouteSegments: Point[][] = [];

    for (const pathEl of Array.from(pathGroup.querySelectorAll("path"))) {
      const d = pathEl.getAttribute("d");
      if (!d) continue;

      const parsed = parseSvgPathD(d, scale);
      if (pathEl.getAttribute("stroke-dasharray")) {
        skiRouteSegments.push(...parsed);
      } else {
        segments.push(...parsed);
      }
    }

    if (segments.length === 0 && skiRouteSegments.length === 0) continue;

    const iconGroup = group.querySelector(`g[id="${featureId}_icon"]`);
    const icons: Point[] = [];
    if (iconGroup) {
      for (const circle of Array.from(iconGroup.querySelectorAll("circle"))) {
        const cx = parseFloat(circle.getAttribute("cx") ?? "");
        const cy = parseFloat(circle.getAttribute("cy") ?? "");
        if (!isNaN(cx) && !isNaN(cy)) icons.push({ x: cx * scale, y: cy * scale });
      }
      for (const rect of Array.from(iconGroup.querySelectorAll("rect"))) {
        const x = parseFloat(rect.getAttribute("x") ?? "");
        const y = parseFloat(rect.getAttribute("y") ?? "");
        const w = parseFloat(rect.getAttribute("width") ?? "");
        const h = parseFloat(rect.getAttribute("height") ?? "");
        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
          icons.push({ x: (x + w / 2) * scale, y: (y + h / 2) * scale });
        }
      }
    }

    const m = meta.get(featureId);
    let number = m?.number;
    if (!number && icons.length > 0) {
      const symbolGroup = group.querySelector(`g[id="${featureId}_symbol"]`);
      const symbolText = symbolGroup?.querySelector("text")?.textContent?.trim();
      if (symbolText) number = symbolText;
    }
    pistes.push({
      id: featureId,
      name: m?.name ?? featureId,
      difficulty: m?.difficulty ?? "unknown",
      segments,
      ...(skiRouteSegments.length > 0 ? { skiRouteSegments } : {}),
      ...(icons.length > 0 ? { icons } : {}),
      number,
      lengthM: m?.lengthM,
      status: m?.status,
    });
  }

  return pistes;
}

// ─── lift parsing ─────────────────────────────────────────────────────────────

function parseLifts(doc: Document, meta: Map<string, LiftMeta>, scale: number): Lift[] {
  const lifts: Lift[] = [];
  const groupPattern = /^L_(\d+)_group$/;

  for (const group of Array.from(doc.querySelectorAll("g[id]"))) {
    const id = group.getAttribute("id") ?? "";
    const match = groupPattern.exec(id);

    if (!match) continue;

    const oid = match[1];
    const featureId = `L_${oid}`;
    const pathGroup = group.querySelector(`g[id="${featureId}_path"]`) ?? group;

    const segments: Point[][] = [];

    for (const polyEl of Array.from(pathGroup.querySelectorAll("polyline"))) {
      const points = polyEl.getAttribute("points");
      if (!points) continue;
      const seg = parsePolylinePoints(points, scale);
      if (seg.length > 0) segments.push(seg);
    }

    for (const pathEl of Array.from(pathGroup.querySelectorAll("path"))) {
      const d = pathEl.getAttribute("d");
      if (!d) continue;
      const parsed = parseSvgPathD(d, scale);
      segments.push(...parsed);
    }

    for (const lineEl of Array.from(pathGroup.querySelectorAll("line"))) {
      const x1 = lineEl.getAttribute("x1");
      const y1 = lineEl.getAttribute("y1");
      const x2 = lineEl.getAttribute("x2");
      const y2 = lineEl.getAttribute("y2");
      if (x1 && y1 && x2 && y2) {
        segments.push([
          { x: parseFloat(x1) * scale, y: parseFloat(y1) * scale },
          { x: parseFloat(x2) * scale, y: parseFloat(y2) * scale }
        ]);
      }
    }

    if (segments.length === 0) continue;

    const iconGroup = group.querySelector(`g[id="${featureId}_icon"]`);
    const iconCircle = iconGroup?.querySelector('circle.icon') ?? iconGroup?.querySelector('circle[class="icon"]');
    let icon: Point | undefined;

    if (iconCircle) {
      const cx = parseFloat(iconCircle.getAttribute("cx") ?? "0");
      const cy = parseFloat(iconCircle.getAttribute("cy") ?? "0");
      if (!isNaN(cx) && !isNaN(cy)) {
        icon = { x: cx * scale, y: cy * scale };
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
  if (!fill) return undefined;

  const lowerFill = fill.toLowerCase();
  if (lowerFill === "white") return 0xffffff;
  if (lowerFill === "black") return 0x000000;
  if (lowerFill === "aqua" || lowerFill === "cyan") return 0x00ffff;
  if (lowerFill === "none" || lowerFill === "transparent") return undefined;

  if (!fill.startsWith("#")) return undefined;

  let hex = fill.slice(1);
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return parseInt(hex, 16);
}

function parseLabels(doc: Document, scale: number): MapLabel[] {
  const labels: MapLabel[] = [];
  const group = doc.getElementById("txt_group_1") ?? doc.querySelector("g");

  if (!group) return labels;

  type BgRect = { color: number; x: number; y: number; w: number; h: number };
  const bgRects: BgRect[] = [];

  for (const poly of Array.from(group.querySelectorAll("polygon"))) {
    const pointsAttr = poly.getAttribute("points");
    const fillAttr = poly.getAttribute("fill") ?? poly.getAttribute("style");

    if (!pointsAttr) continue;

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
    if (color === undefined) continue;

    const coords = pointsAttr.trim().split(/[\s,]+/);
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i + 1 < coords.length; i += 2) {
      const px = parseFloat(coords[i]);
      const py = parseFloat(coords[i + 1]);
      if (!isNaN(px) && !isNaN(py)) { xs.push(px); ys.push(py); }
    }

    if (xs.length === 0) continue;

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    bgRects.push({
      color,
      x: minX * scale,
      y: minY * scale,
      w: (maxX - minX) * scale,
      h: (maxY - minY) * scale,
    });
  }

  for (const el of Array.from(group.querySelectorAll("text"))) {
    const text = el.textContent?.trim() ?? "";
    if (!text) continue;

    const x = parseFloat(el.getAttribute("x") ?? "0") * scale;
    const y = parseFloat(el.getAttribute("y") ?? "0") * scale;

    const styleAttr = el.getAttribute("style") ?? "";
    const fillAttr = el.getAttribute("fill");

    let svgFontSize = 7;
    const fsMatch = /font-size:\s*([\d.]+)px/.exec(styleAttr) ?? /font-size:\s*([\d.]+)/.exec(styleAttr);
    if (fsMatch) svgFontSize = parseFloat(fsMatch[1]);
    else if (el.getAttribute("font-size")) svgFontSize = parseFloat(el.getAttribute("font-size")!);
    const fontSize = svgFontSize * scale;

    let fontWeight: "bold" | "normal" = "normal";
    const fwMatch = /font-weight:\s*(\w+)/.exec(styleAttr);
    if (fwMatch) fontWeight = fwMatch[1] === "bold" ? "bold" : "normal";
    else if (el.getAttribute("font-weight") === "bold") fontWeight = "bold";

    let colorHex: string | null = null;
    const fillMatch = /fill:\s*(#[0-9a-fA-F]+)/.exec(styleAttr);
    if (fillMatch) colorHex = fillMatch[1];
    else if (fillAttr) colorHex = fillAttr;
    const color = parseHexColor(colorHex) ?? 0x000000;

    const matchingBg = bgRects.find(
      (bg) => x >= bg.x && x <= bg.x + bg.w && y >= bg.y && y <= bg.y + bg.h,
    );

    const tier: 1 | 2 | 3 | 4 = svgFontSize === 7 ? 1 : svgFontSize >= 8 ? 2 : svgFontSize >= 6 ? 3 : 4;

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
    if (!isNaN(x) && !isNaN(y)) result.push({ x: x * scale, y: y * scale });
  }
  return result;
}

// ─── SVG path parser ──────────────────────────────────────────────────────────

function parseSvgPathD(d: string, scale: number): Point[][] {
  const segments: Point[][] = [];
  let current: Point[] = [];
  let cx = 0; let cy = 0;
  let prevCp2x = 0; let prevCp2y = 0;
  let lastCmd = "";

  const tokenRe = /([MmCcSsLlHhVvAaTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const tokens: Array<{ cmd?: string; num?: number }> = [];
  let tok: RegExpExecArray | null;

  while ((tok = tokenRe.exec(d)) !== null) {
    if (tok[1]) tokens.push({ cmd: tok[1] });
    else if (tok[2]) tokens.push({ num: parseFloat(tok[2]) });
  }

  let i = 0;
  const nextNum = (): number => {
    while (i < tokens.length && tokens[i].cmd !== undefined) i++;
    return i < tokens.length ? (tokens[i++].num ?? 0) : 0;
  };

  const pushPoint = (px: number, py: number) => current.push({ x: px * scale, y: py * scale });
  const startSegment = (px: number, py: number) => {
    if (current.length > 0) segments.push(current);
    current = [];
    cx = px; cy = py;
    pushPoint(cx, cy);
  };

  while (i < tokens.length) {
    if (tokens[i].cmd !== undefined) {
      const cmd = tokens[i].cmd!;
      i++;
      let repeating = true;

      while (repeating) {
        const hasMore = i < tokens.length && tokens[i].num !== undefined;
        if (!hasMore && cmd !== "Z" && cmd !== "z") break;

        switch (cmd) {
          case "M": {
            const mx = nextNum(); const my = nextNum();
            startSegment(mx, my); lastCmd = "M";
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx = nextNum(); cy = nextNum(); pushPoint(cx, cy);
            }
            repeating = false; break;
          }
          case "m": {
            const dx = nextNum(); const dy = nextNum();
            startSegment(cx + dx, cy + dy); lastCmd = "m";
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum(); cy += nextNum(); pushPoint(cx, cy);
            }
            repeating = false; break;
          }
          case "c": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              const dx1 = nextNum(); const dy1 = nextNum();
              const dx2 = nextNum(); const dy2 = nextNum();
              const dx = nextNum(); const dy = nextNum();
              prevCp2x = cx + dx2; prevCp2y = cy + dy2;
              sampleCubic(cx, cy, cx + dx1, cy + dy1, prevCp2x, prevCp2y, cx + dx, cy + dy, current, scale);
              cx += dx; cy += dy;
            }
            lastCmd = "c"; repeating = false; break;
          }
          case "C": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              const x1 = nextNum(); const y1 = nextNum();
              const x2 = nextNum(); const y2 = nextNum();
              const x = nextNum(); const y = nextNum();
              prevCp2x = x2; prevCp2y = y2;
              sampleCubic(cx, cy, x1, y1, prevCp2x, prevCp2y, x, y, current, scale);
              cx = x; cy = y;
            }
            lastCmd = "C"; repeating = false; break;
          }
          case "s": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              const dx2 = nextNum(); const dy2 = nextNum();
              const dx = nextNum(); const dy = nextNum();
              const implicitCp1x = (lastCmd === "c" || lastCmd === "C" || lastCmd === "s" || lastCmd === "S") ? 2 * cx - prevCp2x : cx;
              const implicitCp1y = (lastCmd === "c" || lastCmd === "C" || lastCmd === "s" || lastCmd === "S") ? 2 * cy - prevCp2y : cy;
              prevCp2x = cx + dx2; prevCp2y = cy + dy2;
              sampleCubic(cx, cy, implicitCp1x, implicitCp1y, prevCp2x, prevCp2y, cx + dx, cy + dy, current, scale);
              cx += dx; cy += dy;
            }
            lastCmd = "s"; repeating = false; break;
          }
          case "l": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum(); cy += nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "l"; repeating = false; break;
          }
          case "L": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx = nextNum(); cy = nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "L"; repeating = false; break;
          }
          case "h": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "h"; repeating = false; break;
          }
          case "H": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx = nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "H"; repeating = false; break;
          }
          case "v": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cy += nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "v"; repeating = false; break;
          }
          case "V": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cy = nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "V"; repeating = false; break;
          }
          case "a": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
              cx += nextNum(); cy += nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "a"; repeating = false; break;
          }
          case "A": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              nextNum(); nextNum(); nextNum(); nextNum(); nextNum();
              cx = nextNum(); cy = nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "A"; repeating = false; break;
          }
          case "t": {
            while (i < tokens.length && tokens[i].num !== undefined) {
              cx += nextNum(); cy += nextNum(); pushPoint(cx, cy);
            }
            lastCmd = "t"; repeating = false; break;
          }
          case "Z": case "z": {
            lastCmd = cmd; repeating = false; break;
          }
          default:
            repeating = false;
        }
      }
    } else {
      i++;
    }
  }

  if (current.length > 0) segments.push(current);
  return segments;
}

const BEZIER_STEPS = 10;
function sampleCubic(p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, out: Point[], scale: number) {
  for (let step = 1; step <= BEZIER_STEPS; step++) {
    const t = step / BEZIER_STEPS; const mt = 1 - t;
    const x = mt * mt * mt * p0x + 3 * mt * mt * t * p1x + 3 * mt * t * t * p2x + t * t * t * p3x;
    const y = mt * mt * mt * p0y + 3 * mt * mt * t * p1y + 3 * mt * t * t * p2y + t * t * t * p3y;
    out.push({ x: x * scale, y: y * scale });
  }
}
