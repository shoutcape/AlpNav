import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const resortId = process.argv[2];
if (!resortId) {
  console.error("Usage: node match-anchors.mjs <resort-id>");
  process.exit(1);
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "resorts", resortId, "overlays");

async function main() {
  const [osmAnchors, dataJson, lSvgText, manifestJson] = await Promise.all([
    readFile(path.join(ROOT, "osm-anchors.json"), "utf8").then(JSON.parse),
    readFile(path.join(ROOT, "data.json"), "utf8").then(JSON.parse),
    readFile(path.join(ROOT, "L.svg"), "utf8"),
    readFile(path.join(ROOT, "..", "panorama", "manifest.json"), "utf8").then(JSON.parse),
  ]);

  // Compute panorama scale factor (same as parser.ts)
  const svgWidthMatch = lSvgText.match(/(?:width="(\d+(?:\.\d+)?)")|(?:viewBox="[\d.]+ [\d.]+ ([\d.]+))/);
  const svgWidth = parseFloat(svgWidthMatch?.[1] ?? svgWidthMatch?.[2] ?? "1024");
  const maxLevel = manifestJson.levels[manifestJson.levels.length - 1];
  const scale = maxLevel.width / svgWidth;

  const anchors = [];

  // ─── Match lifts ─────────────────────────────────────────────────────────
  const liftEndpoints = parseLiftEndpoints(lSvgText, scale);
  let liftMatches = 0;
  const usedOsmLifts = new Set();

  // Iterate Intermaps lifts and find the single best OSM match for each
  for (const imLift of dataJson.lifts) {
    const imName = imLift.popup?.title;
    if (!imName) continue;

    const endpoints = liftEndpoints.get(imLift.id);
    if (!endpoints) continue;

    let bestOsm = null;
    let bestScore = 0;
    for (const osmLift of osmAnchors.lifts) {
      if (!osmLift.name || usedOsmLifts.has(osmLift.osmId)) continue;
      const score = nameSimilarity(osmLift.name, imName);
      if (score > bestScore) {
        bestScore = score;
        bestOsm = osmLift;
      }
    }

    if (!bestOsm || bestScore < 0.4) continue;

    usedOsmLifts.add(bestOsm.osmId);
    liftMatches++;

    anchors.push({
      id: `${imLift.id}_valley`,
      name: imName + " (valley)",
      type: "lift-station",
      geo: bestOsm.valley,
      panorama: endpoints.valley,
      snapRadius: 30,
    });

    anchors.push({
      id: `${imLift.id}_mountain`,
      name: imName + " (mountain)",
      type: "lift-station",
      geo: bestOsm.mountain,
      panorama: endpoints.mountain,
      snapRadius: 30,
    });
  }

  // ─── Match restaurants ───────────────────────────────────────────────────
  // Iterate Intermaps entries and find the single best OSM match for each,
  // preventing duplicates (multiple OSM restaurants matching the same entry).
  const gastroEntries = [
    ...(dataJson.pois["202"] ?? []),
    ...(dataJson.pois["3001"] ?? []),
    ...(dataJson.pois["3002"] ?? []),
  ];
  let restaurantMatches = 0;
  const usedOsmRestaurants = new Set();

  for (const g of gastroEntries) {
    const gName = g.popup?.title;
    if (!gName) continue;
    const pos = g.position;
    if (!pos || pos.x == null || pos.y == null) continue;

    let bestOsm = null;
    let bestScore = 0;
    for (const osmRest of osmAnchors.restaurants) {
      if (!osmRest.name || usedOsmRestaurants.has(osmRest.osmId)) continue;
      const score = nameSimilarity(osmRest.name, gName);
      if (score > bestScore) {
        bestScore = score;
        bestOsm = osmRest;
      }
    }

    if (!bestOsm || bestScore < 0.4) continue;

    usedOsmRestaurants.add(bestOsm.osmId);
    restaurantMatches++;
    anchors.push({
      id: `gastro_${g.id}`,
      name: g.popup.title,
      type: "restaurant",
      geo: bestOsm.geo,
      panorama: { x: pos.x * scale, y: pos.y * scale },
      snapRadius: 20,
    });
  }

  process.stdout.write(`Matched ${liftMatches} lifts (${liftMatches * 2} stations), ${restaurantMatches} restaurants\n`);
  process.stdout.write(`Total anchor points: ${anchors.length}\n`);

  const dest = path.join(ROOT, "anchor-points.json");
  await writeFile(dest, JSON.stringify(anchors, null, 2) + "\n");
  process.stdout.write(`Written to ${dest}\n`);
}

// ─── SVG lift endpoint parsing (regex-based, no jsdom) ───────────────────────

function parseLiftEndpoints(svgText, scale) {
  const endpoints = new Map();
  // Match each lift group block
  const groupPattern = /id="L_(\d+)_group"[\s\S]*?(?=<g id="L_\d+_group"|$)/g;
  let gm;

  while ((gm = groupPattern.exec(svgText)) !== null) {
    const oid = gm[1];
    const block = gm[0];

    // Look for polyline points in the _path subgroup
    const polyMatch = block.match(/id="L_\d+_path"[\s\S]*?<polyline[^>]+points="([^"]+)"/);
    if (polyMatch) {
      const pairs = polyMatch[1].trim().split(/\s+/).map((p) => {
        const [x, y] = p.split(",").map(Number);
        return { x: x * scale, y: y * scale };
      });
      if (pairs.length >= 2) {
        endpoints.set(`L_${oid}`, { valley: pairs[0], mountain: pairs[pairs.length - 1] });
        continue;
      }
    }

    // Fallback: look for line elements
    const lineMatch = block.match(/<line[^>]+x1="([\d.]+)"[^>]+y1="([\d.]+)"[^>]+x2="([\d.]+)"[^>]+y2="([\d.]+)"/);
    if (lineMatch) {
      endpoints.set(`L_${oid}`, {
        valley: { x: parseFloat(lineMatch[1]) * scale, y: parseFloat(lineMatch[2]) * scale },
        mountain: { x: parseFloat(lineMatch[3]) * scale, y: parseFloat(lineMatch[4]) * scale },
      });
    }
  }

  return endpoints;
}

// ─── Name matching ───────────────────────────────────────────────────────────

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[''`´]/g, "")
    .replace(/\([^)]*\)/g, "") // remove parentheticals like "(1.850 m)"
    .replace(/[^a-zäöüß0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a, b) {
  const aN = normalize(a);
  const bN = normalize(b);

  if (aN === bN) return 1.0;
  if (aN.includes(bN) || bN.includes(aN)) return 0.8;

  const aWords = new Set(aN.split(" ").filter((w) => w.length > 1));
  const bWords = new Set(bN.split(" ").filter((w) => w.length > 1));
  if (aWords.size === 0 || bWords.size === 0) return 0;

  let matches = 0;
  for (const w of aWords) {
    for (const bw of bWords) {
      if (w === bw || w.includes(bw) || bw.includes(w)) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(aWords.size, bWords.size);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
