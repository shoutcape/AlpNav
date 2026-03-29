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
  // Gastronomy categories — same IDs used by the parser (202, 3001, 3002)
  const GASTRO_CATEGORIES = ["202", "3001", "3002"];
  const gastroEntries = GASTRO_CATEGORIES.flatMap((id) => dataJson.pois?.[id] ?? []);
  let restaurantMatches = 0;
  const usedOsmRestaurants = new Set();

  for (const g of gastroEntries) {
    const gName = g.popup?.title;
    if (!gName) continue;
    const pos = g.position;
    if (!pos || pos.x == null || pos.y == null) continue;

    // Extract domain keywords from website URL for fallback matching
    const website = g.popup?.info?.website ?? "";
    const urlKeywords = extractUrlKeywords(website);

    let bestOsm = null;
    let bestScore = 0;
    for (const osmRest of osmAnchors.restaurants) {
      if (!osmRest.name || usedOsmRestaurants.has(osmRest.osmId)) continue;
      let score = nameSimilarity(osmRest.name, gName);
      // Fallback: check OSM name against URL keywords
      if (score < 0.4 && urlKeywords.length > 0) {
        const urlScore = nameSimilarity(osmRest.name, urlKeywords.join(" "));
        score = Math.max(score, urlScore);
      }
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

    // Try polyline first
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

    // Try path element (extract first M coords and trace to last point)
    const pathMatch = block.match(/id="L_\d+_path"[\s\S]*?<path[^>]+d="([^"]+)"/);
    if (pathMatch) {
      const pts = extractPathEndpoints(pathMatch[1], scale);
      if (pts) {
        endpoints.set(`L_${oid}`, pts);
        continue;
      }
    }

    // Fallback: line elements
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

/** Extract first and last points from an SVG path d-attribute */
function extractPathEndpoints(d, scale) {
  // Get the starting M point
  const mMatch = d.match(/^M\s*([\d.e+-]+)[\s,]+([\d.e+-]+)/i);
  if (!mMatch) return null;

  const firstX = parseFloat(mMatch[1]) * scale;
  const firstY = parseFloat(mMatch[2]) * scale;

  // Walk through all coordinate pairs to find the last absolute position
  // Simple approach: find all number pairs and track absolute position
  let cx = parseFloat(mMatch[1]);
  let cy = parseFloat(mMatch[2]);
  let lastAbsCmd = "M";

  // Tokenize: split into commands and numbers
  const tokens = d.match(/[a-zA-Z]|[-+]?[\d.]+(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      lastAbsCmd = t;
      i++;
      continue;
    }
    // It's a number — consume coordinate pairs based on last command
    const x = parseFloat(tokens[i]);
    const y = parseFloat(tokens[i + 1]);
    if (isNaN(x) || isNaN(y)) { i++; continue; }

    if (lastAbsCmd === lastAbsCmd.toUpperCase()) {
      // Absolute
      cx = x; cy = y;
    } else {
      // Relative
      cx += x; cy += y;
    }
    i += 2;
    // Cubic bezier has 6 numbers per segment, skip the control points
    if (lastAbsCmd === "c" || lastAbsCmd === "C") i += 4;
    if (lastAbsCmd === "s" || lastAbsCmd === "S") i += 2;
    if (lastAbsCmd === "q" || lastAbsCmd === "Q") i += 2;
  }

  return {
    valley: { x: firstX, y: firstY },
    mountain: { x: cx * scale, y: cy * scale },
  };
}

/** Extract meaningful keywords from a URL domain (e.g. "schnitzelhuette.at" → ["schnitzelhuette"]) */
function extractUrlKeywords(url) {
  if (!url) return [];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const domain = hostname.split(".")[0]; // e.g. "schnitzelhuette"
    // Split on hyphens and filter short fragments
    return domain.split("-").filter((w) => w.length >= 3);
  } catch {
    return [];
  }
}

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
  let significantMatch = false; // a distinctive word (4+ chars) matched
  for (const w of aWords) {
    for (const bw of bWords) {
      // Exact match
      if (w === bw) {
        matches++;
        if (w.length >= 4) significantMatch = true;
        break;
      }
      // Substring match: only if the shorter word is at least 60% of the longer
      // Prevents "alm" matching "sonnalm" (3/7 = 43%) but allows
      // "rosi" matching "rosis" (4/5 = 80%)
      const shorter = w.length <= bw.length ? w : bw;
      const longer = w.length <= bw.length ? bw : w;
      if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) {
        matches++;
        if (shorter.length >= 4) significantMatch = true;
        break;
      }
    }
  }

  const ratio = matches / Math.max(aWords.size, bWords.size);
  // Boost score when a distinctive word matches (handles translated names
  // like "Rosi's Schnitzelhütte" ↔ "Rosi's escalope hut")
  if (significantMatch && matches >= 1 && ratio < 0.4) return 0.4;
  return ratio;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
