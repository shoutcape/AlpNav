import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BBOXES = {
  "zillertal-arena": { south: 47.10, west: 11.87, north: 47.35, east: 12.25 },
  "mayrhofner-bergbahnen": { south: 47.12, west: 11.70, north: 47.21, east: 11.90 },
  "hochzillertal-hochfugen-spieljoch": { south: 47.15, west: 11.80, north: 47.30, east: 11.95 },
  "ski-gletscherwelt-zillertal-3000": { south: 47.04, west: 11.62, north: 47.18, east: 11.82 },
  "hintertuxer-gletscher": { south: 47.02, west: 11.62, north: 47.10, east: 11.72 },
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export function parseRestaurants(elements) {
  const restaurants = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name ?? null;
    if (!name) continue;

    const amenityType = tags.amenity ?? tags.tourism ?? null;
    if (!amenityType) continue;

    if (el.type === "node" && el.lat != null && el.lon != null) {
      restaurants.push({
        osmId: `node/${el.id}`,
        name,
        amenityType,
        geo: { lat: el.lat, lng: el.lon },
      });
    }

    if (el.type === "way" && !tags.aerialway && el.geometry) {
      const pts = el.geometry.filter((n) => n && n.lat != null && n.lon != null);
      if (pts.length === 0) continue;
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const lng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
      restaurants.push({
        osmId: `way/${el.id}`,
        name,
        amenityType,
        geo: { lat, lng },
      });
    }
  }

  return restaurants;
}

async function main() {
  const resortId = process.argv[2];
  if (!resortId || !BBOXES[resortId]) {
    console.error("Usage: node scripts/fetch-osm-restaurants.mjs <resort-id>");
    console.error(`Available resorts: ${Object.keys(BBOXES).join(", ")}`);
    process.exit(1);
  }

  const bbox = BBOXES[resortId];
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const query = `
[out:json][timeout:60];
(
  node["amenity"~"restaurant|cafe|bar|pub"](${bboxStr});
  way["amenity"~"restaurant|cafe|bar|pub"](${bboxStr});
  node["tourism"~"alpine_hut|wilderness_hut"](${bboxStr});
  way["tourism"~"alpine_hut|wilderness_hut"](${bboxStr});
);
out geom qt;
`.trim();

  process.stdout.write(`Fetching OSM restaurants for ${resortId} (bbox: ${bboxStr})...\n`);

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const raw = await response.json();
  const restaurants = parseRestaurants(raw.elements ?? []);

  process.stdout.write(`Found ${restaurants.length} restaurants\n`);

  const outputDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "public",
    "resorts",
    resortId,
    "overlays",
  );
  await mkdir(outputDir, { recursive: true });

  const dest = path.join(outputDir, "osm-restaurants.json");
  await writeFile(dest, JSON.stringify(restaurants, null, 2) + "\n");
  process.stdout.write(`Written to ${dest}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
