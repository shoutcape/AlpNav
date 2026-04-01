// scripts/generate-lift-anchors.ts
//
// Usage: npx tsx scripts/generate-lift-anchors.ts [--dry-run]
//
// For each resort:
// 1. Reads intermaps lift data (name, altitude, SVG endpoints)
// 2. Queries OSM Overpass for lift geo coordinates
// 3. Matches by normalized name similarity
// 4. Outputs lift-bottom and lift-top anchor entries

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

// --- Resort configs ---
const RESORTS = [
  { id: "zillertal-arena", bbox: { south: 47.10, west: 11.87, north: 47.35, east: 12.25 } },
  { id: "mayrhofner-bergbahnen", bbox: { south: 47.12, west: 11.82, north: 47.20, east: 11.90 } },
  { id: "ski-gletscherwelt-zillertal-3000", bbox: { south: 47.04, west: 11.62, north: 47.18, east: 11.82 } },
  { id: "hintertuxer-gletscher", bbox: { south: 47.02, west: 11.62, north: 47.10, east: 11.72 } },
  { id: "hochzillertal-hochfugen-spieljoch", bbox: { south: 47.15, west: 11.80, north: 47.30, east: 11.95 } },
];

type AnchorPoint = {
  id: string;
  name: string;
  type: string;
  geo: { lat: number; lng: number };
  panorama: { x: number; y: number };
  snapRadius: number;
};

type IntermapsLift = {
  id: string;
  name: string;
  altitudeValley?: number;
  altitudeMountain?: number;
  endpointA: { x: number; y: number };
  endpointB: { x: number; y: number };
};

type OsmLift = {
  osmId: number;
  name: string;
  aerialway: string;
  startNode: { lat: number; lon: number };
  endNode: { lat: number; lon: number };
};

type LiftMatch = {
  intermapsId: string;
  osmId: number;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const CACHE_DIR = join(process.cwd(), "scripts/.osm-cache");

// --- Overpass: get full geometry so we can extract valley/mountain station coords ---
async function queryOverpassLifts(bbox: typeof RESORTS[0]["bbox"], resortId?: string): Promise<OsmLift[]> {
  // Check cache first to avoid hammering Overpass
  if (resortId) {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    const cachePath = join(CACHE_DIR, `${resortId}.json`);
    if (existsSync(cachePath)) {
      console.log(`    Using cached OSM data`);
      return JSON.parse(readFileSync(cachePath, "utf-8"));
    }
  }
  const query = `
    [out:json][timeout:30];
    way["aerialway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    out geom;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.log(`    Overpass retry ${attempt + 1}/3 after 30s...`);
      await new Promise((r) => setTimeout(r, 30000));
    }
    res = await fetch(url);
    if (res.ok) break;
  }
  if (!res || !res.ok) throw new Error(`Overpass failed after 3 attempts: ${res?.status}`);
  const data = await res.json();

  const result = (data.elements as any[])
    .filter((el: any) => el.tags?.name && el.geometry?.length >= 2)
    .map((el: any) => ({
      osmId: el.id,
      name: el.tags.name,
      aerialway: el.tags.aerialway,
      startNode: { lat: el.geometry[0].lat, lon: el.geometry[0].lon },
      endNode: { lat: el.geometry[el.geometry.length - 1].lat, lon: el.geometry[el.geometry.length - 1].lon },
    }));

  // Cache results
  if (resortId) {
    writeFileSync(join(CACHE_DIR, `${resortId}.json`), JSON.stringify(result, null, 2));
  }
  return result;
}

// --- Elevation lookup via Open-Meteo API ---
async function getElevations(coords: { lat: number; lon: number }[]): Promise<number[]> {
  const lats = coords.map((c) => c.lat).join(",");
  const lons = coords.map((c) => c.lon).join(",");
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo elevation failed: ${res.status}`);
  const data = await res.json();
  return data.elevation as number[];
}

// --- Read intermaps lift data from data.json ---
function loadIntermapsLiftMeta(resortId: string): { id: string; name: string; altitudeValley?: number; altitudeMountain?: number }[] {
  const dataPath = join(process.cwd(), "public/resorts", resortId, "overlays/data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  // data.json is { lifts: [...], slopes: [...], ... } — NOT a flat array
  return (data.lifts ?? []).map((item: any) => ({
    id: item.id,
    name: item.popup?.title || item.id,
    altitudeValley: item.popup?.["additional-info"]?.["altitude-valley"],
    altitudeMountain: item.popup?.["additional-info"]?.["altitude-mountain"],
  }));
}

// --- Extract lift SVG line endpoints from L.svg using DOM parser ---
// Mirrors the logic in parser.ts:498-574 (parseLifts) which handles
// <polyline>, <path>, and <line> elements. Uses jsdom for Node.js DOM access.
// IMPORTANT: 4 of 5 resorts use <path d="..."> elements, not <polyline>.
function loadLiftSvgEndpoints(resortId: string): Map<string, { endpointA: { x: number; y: number }; endpointB: { x: number; y: number } }> {
  const manifestPath = join(process.cwd(), "public/resorts", resortId, "panorama/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const maxLevel = manifest.levels[manifest.levels.length - 1];

  const svgPath = join(process.cwd(), "public/resorts", resortId, "overlays/L.svg");
  const svgText = readFileSync(svgPath, "utf-8");
  const dom = new JSDOM(svgText, { contentType: "image/svg+xml" });
  const doc = dom.window.document;

  const svgWidth = parseFloat(doc.documentElement.getAttribute("width") || "1024");
  const scale = maxLevel.width / svgWidth;

  const results = new Map<string, { endpointA: { x: number; y: number }; endpointB: { x: number; y: number } }>();
  const groupPattern = /^L_(\d+)_group$/;

  for (const group of Array.from(doc.querySelectorAll("g[id]"))) {
    const id = group.getAttribute("id") ?? "";
    const match = groupPattern.exec(id);
    if (!match) continue;

    const featureId = `L_${match[1]}`;
    const pathGroup = group.querySelector(`g[id="${featureId}_path"]`) ?? group;
    const allPoints: { x: number; y: number }[] = [];

    // Extract from <polyline> elements
    for (const polyEl of Array.from(pathGroup.querySelectorAll("polyline"))) {
      const points = polyEl.getAttribute("points");
      if (!points) continue;
      const pairs = points.trim().split(/[\s,]+/);
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const x = parseFloat(pairs[i]);
        const y = parseFloat(pairs[i + 1]);
        if (!isNaN(x) && !isNaN(y)) allPoints.push({ x: x * scale, y: y * scale });
      }
    }

    // Extract from <path d="..."> elements — critical for 4/5 resorts
    for (const pathEl of Array.from(pathGroup.querySelectorAll("path"))) {
      const d = pathEl.getAttribute("d");
      if (!d) continue;
      const coords: { x: number; y: number }[] = [];
      let cx = 0, cy = 0;

      const tokens: string[] = d.match(/[MmLlCcSsHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
      let cmd = "";
      const nums: number[] = [];

      for (const tok of tokens) {
        if (/[A-Za-z]/.test(tok)) {
          cmd = tok;
          nums.length = 0;
        } else {
          nums.push(parseFloat(tok));
          if (cmd === "M" && nums.length === 2) {
            cx = nums[0]; cy = nums[1];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "m" && nums.length === 2) {
            cx += nums[0]; cy += nums[1];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "L" && nums.length === 2) {
            cx = nums[0]; cy = nums[1];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "l" && nums.length === 2) {
            cx += nums[0]; cy += nums[1];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "C" && nums.length === 6) {
            cx = nums[4]; cy = nums[5];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "c" && nums.length === 6) {
            cx += nums[4]; cy += nums[5];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "S" && nums.length === 4) {
            cx = nums[2]; cy = nums[3];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          } else if (cmd === "s" && nums.length === 4) {
            cx += nums[2]; cy += nums[3];
            coords.push({ x: cx * scale, y: cy * scale });
            nums.length = 0;
          }
        }
      }
      allPoints.push(...coords);
    }

    // Extract from <line> elements
    for (const lineEl of Array.from(pathGroup.querySelectorAll("line"))) {
      const x1 = lineEl.getAttribute("x1");
      const y1 = lineEl.getAttribute("y1");
      const x2 = lineEl.getAttribute("x2");
      const y2 = lineEl.getAttribute("y2");
      if (x1 && y1 && x2 && y2) {
        allPoints.push(
          { x: parseFloat(x1) * scale, y: parseFloat(y1) * scale },
          { x: parseFloat(x2) * scale, y: parseFloat(y2) * scale },
        );
      }
    }

    if (allPoints.length >= 2) {
      results.set(featureId, {
        endpointA: allPoints[0],
        endpointB: allPoints[allPoints.length - 1],
      });
    }
  }

  return results;
}

// --- Normalize name for matching ---
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zäöüß0-9]/g, "")
    .replace(/(bahn|lift|express|jet)$/g, "");
}

// --- Manual overrides for known mismatches ---
// The name matcher confuses similar names (e.g. "Penkenbahn" vs "Penken-Express").
// These overrides force correct pairings. Key = intermaps ID, value = OSM ID.
const MANUAL_OVERRIDES: Record<string, number> = {
  // Mayrhofen: Penkenbahn is the gondola, Penken-Express is the chairlift
  "L_60429": 30978865,   // Penkenbahn → Penkenbahn (gondola)
  "L_60432": 26158184,   // 6SB Penken Express → Penken-Express (chair_lift)
  // Mayrhofen: Horbergbahn is a gondola, not the same as 8er Horbergjoch
  "L_60430": 156215470,  // Horbergbahn → Horbergbahn (gondola)
};

// IDs to skip matching (no valid OSM match in this resort's bbox)
const SKIP_IDS = new Set([
  "L_604204", // 8er Horbergjoch — not in Mayrhofen OSM bbox
  "L_60443",  // Horberg Shuttle — falsely matches Horbergbahn (different lift)
]);

// --- Match OSM lifts to intermaps lifts by name ---
function matchLiftsByName(
  intermapsLifts: { id: string; name: string; altitudeValley?: number; altitudeMountain?: number }[],
  osmLifts: OsmLift[],
): LiftMatch[] {
  const matches: LiftMatch[] = [];
  const usedOsm = new Set<number>();
  const usedIm = new Set<string>();

  // Pass 0: apply manual overrides
  for (const im of intermapsLifts) {
    const overrideOsmId = MANUAL_OVERRIDES[im.id];
    if (overrideOsmId !== undefined) {
      const osm = osmLifts.find((o) => o.osmId === overrideOsmId);
      if (osm) {
        matches.push({ intermapsId: im.id, osmId: osm.osmId, confidence: "high", reason: "manual override" });
        usedOsm.add(osm.osmId);
        usedIm.add(im.id);
      }
    }
    if (SKIP_IDS.has(im.id)) usedIm.add(im.id);
  }

  // Pass 1: exact normalized match
  for (const im of intermapsLifts) {
    if (usedIm.has(im.id)) continue;
    const imNorm = normalize(im.name);
    for (const osm of osmLifts) {
      if (usedOsm.has(osm.osmId)) continue;
      const osmNorm = normalize(osm.name);
      if (imNorm === osmNorm) {
        matches.push({ intermapsId: im.id, osmId: osm.osmId, confidence: "high", reason: "exact normalized match" });
        usedOsm.add(osm.osmId);
        usedIm.add(im.id);
        break;
      }
    }
  }

  // Pass 2: substring containment
  for (const im of intermapsLifts) {
    if (usedIm.has(im.id)) continue;
    const imNorm = normalize(im.name);
    if (imNorm.length < 4) continue; // skip very short names

    let bestOsm: OsmLift | null = null;
    let bestScore = 0;
    for (const osm of osmLifts) {
      if (usedOsm.has(osm.osmId)) continue;
      const osmNorm = normalize(osm.name);
      if (osmNorm.includes(imNorm) || imNorm.includes(osmNorm)) {
        const score = Math.min(osmNorm.length, imNorm.length);
        if (score > bestScore) {
          bestScore = score;
          bestOsm = osm;
        }
      }
    }
    if (bestOsm) {
      matches.push({ intermapsId: im.id, osmId: bestOsm.osmId, confidence: "medium", reason: "substring match" });
      usedOsm.add(bestOsm.osmId);
      usedIm.add(im.id);
    }
  }

  return matches;
}

// --- Determine which endpoint is bottom/top ---
// Cross-validates intermaps altitude data with OSM elevation to find the
// correct pairing between SVG endpoints and OSM geo endpoints.
// Previous approach used panorama Y independently, which fails for lifts
// that aren't vertically oriented on the panorama.
function assignBottomTop(
  intermaps: IntermapsLift,
  osm: OsmLift,
  osmStartElevation: number,
  osmEndElevation: number,
): { bottom: { panorama: { x: number; y: number }; geo: { lat: number; lng: number } }; top: { panorama: { x: number; y: number }; geo: { lat: number; lng: number } } } {
  const valleyAlt = intermaps.altitudeValley ?? 0;
  const mountainAlt = intermaps.altitudeMountain ?? Infinity;

  // Try both pairings of (panorama endpoint, geo endpoint) and pick the one
  // where OSM elevations best match the known intermaps altitudes.
  // Pairing 1: A↔start, B↔end
  const err1 = Math.abs(osmStartElevation - valleyAlt) + Math.abs(osmEndElevation - mountainAlt);
  // Pairing 2: A↔end, B↔start
  const err2 = Math.abs(osmEndElevation - valleyAlt) + Math.abs(osmStartElevation - mountainAlt);

  const aIsValley = err1 <= err2;

  return {
    bottom: {
      panorama: aIsValley ? intermaps.endpointA : intermaps.endpointB,
      geo: aIsValley
        ? { lat: osm.startNode.lat, lng: osm.startNode.lon }
        : { lat: osm.endNode.lat, lng: osm.endNode.lon },
    },
    top: {
      panorama: aIsValley ? intermaps.endpointB : intermaps.endpointA,
      geo: aIsValley
        ? { lat: osm.endNode.lat, lng: osm.endNode.lon }
        : { lat: osm.startNode.lat, lng: osm.startNode.lon },
    },
  };
}

// --- Main ---
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("DRY RUN — no files will be written\n");

  for (const resort of RESORTS) {
    console.log(`\n=== ${resort.id} ===`);

    // 1. Load existing anchors
    const anchorPath = join(process.cwd(), "public/resorts", resort.id, "overlays/anchor-points.json");
    const existing: AnchorPoint[] = JSON.parse(readFileSync(anchorPath, "utf-8"));
    const nonLiftAnchors = existing.filter((a) => a.type !== "lift-bottom" && a.type !== "lift-top");

    // 2. Load intermaps data
    const liftMeta = loadIntermapsLiftMeta(resort.id);
    const svgEndpoints = loadLiftSvgEndpoints(resort.id);
    console.log(`  Intermaps lifts: ${liftMeta.length}, SVG endpoints: ${svgEndpoints.size}`);

    // 3. Query OSM
    const osmLifts = await queryOverpassLifts(resort.bbox, resort.id);
    console.log(`  OSM lifts (named ways): ${osmLifts.length}`);

    // 4. Match by name
    const matches = matchLiftsByName(liftMeta, osmLifts);
    console.log(`  Matches: ${matches.length}`);

    // 5. Fetch elevations for all matched OSM lift endpoints
    const matchedOsmLifts = matches
      .map((m) => osmLifts.find((l) => l.osmId === m.osmId))
      .filter(Boolean) as OsmLift[];
    const elevationCoords = matchedOsmLifts.flatMap((l) => [
      { lat: l.startNode.lat, lon: l.startNode.lon },
      { lat: l.endNode.lat, lon: l.endNode.lon },
    ]);
    const elevations = elevationCoords.length > 0 ? await getElevations(elevationCoords) : [];
    const elevationMap = new Map<number, { start: number; end: number }>();
    matchedOsmLifts.forEach((l, i) => {
      elevationMap.set(l.osmId, { start: elevations[i * 2], end: elevations[i * 2 + 1] });
    });

    // 6. Build anchor entries
    const liftAnchors: AnchorPoint[] = [];
    for (const match of matches) {
      const im = liftMeta.find((l) => l.id === match.intermapsId);
      const osm = osmLifts.find((l) => l.osmId === match.osmId);
      const endpoints = svgEndpoints.get(match.intermapsId);
      if (!im || !osm || !endpoints) {
        console.log(`  ⚠ skipping ${match.intermapsId}: missing data`);
        continue;
      }

      const elev = elevationMap.get(osm.osmId) ?? { start: 0, end: 0 };
      const full: IntermapsLift = { ...im, ...endpoints };
      const { bottom, top } = assignBottomTop(full, osm, elev.start, elev.end);

      liftAnchors.push({
        id: `${im.id}_bottom`,
        name: `${im.name} (valley)`,
        type: "lift-bottom",
        geo: bottom.geo,
        panorama: bottom.panorama,
        snapRadius: 200,
      });
      liftAnchors.push({
        id: `${im.id}_top`,
        name: `${im.name} (mountain)`,
        type: "lift-top",
        geo: top.geo,
        panorama: top.panorama,
        snapRadius: 200,
      });

      console.log(`  ✓ ${im.name} ↔ ${osm.name} [${match.confidence}] elev: ${elev.start.toFixed(0)}m→${elev.end.toFixed(0)}m`);
    }

    // Report unmatched
    const matchedImIds = new Set(matches.map((m) => m.intermapsId));
    const unmatched = liftMeta.filter((l) => !matchedImIds.has(l.id));
    if (unmatched.length > 0) {
      console.log(`  Unmatched (${unmatched.length}):`);
      for (const l of unmatched) console.log(`    ✗ ${l.id}: ${l.name}`);
    }

    // 7. Write merged anchors
    if (!dryRun) {
      const merged = [...nonLiftAnchors, ...liftAnchors];
      writeFileSync(anchorPath, JSON.stringify(merged, null, 2) + "\n");
      console.log(`  Written: ${liftAnchors.length} lift anchors (${merged.length} total)`);
    } else {
      console.log(`  Would write: ${liftAnchors.length} lift anchors`);
    }

    // Rate limit between resorts (Overpass needs time between requests)
    await new Promise((r) => setTimeout(r, 10000));
  }
}

main().catch(console.error);
