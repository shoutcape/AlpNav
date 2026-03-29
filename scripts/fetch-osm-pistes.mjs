import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BBOXES = {
  "zillertal-arena": { south: 47.15, west: 12.03, north: 47.28, east: 12.23 },
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const resortId = process.argv[2];
if (!resortId || !BBOXES[resortId]) {
  console.error("Usage: node fetch-osm-pistes.mjs <resort-id>");
  console.error(`Available resorts: ${Object.keys(BBOXES).join(", ")}`);
  process.exit(1);
}

const bbox = BBOXES[resortId];
const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

const OUTPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "resorts",
  resortId,
  "overlays",
);

const query = `
[out:json][timeout:25];
(
  way["piste:type"~"(^|;)downhill(;|$)"](${bboxStr});
  rel["type"="route"]["route"="piste"]["piste:type"~"(^|;)downhill(;|$)"](${bboxStr});
);
out geom(${bboxStr}) qt;
`.trim();

async function main() {
  process.stdout.write(`Fetching OSM pistes for ${resortId} (bbox: ${bboxStr})...\n`);

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const raw = await response.json();
  const pistes = parseElements(raw.elements ?? []);

  process.stdout.write(`Found ${pistes.length} pistes (${raw.elements?.length ?? 0} raw elements)\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const dest = path.join(OUTPUT_DIR, "osm-pistes.json");
  await writeFile(dest, JSON.stringify(pistes, null, 2) + "\n");
  process.stdout.write(`Written to ${dest}\n`);
}

/** Parse Overpass elements into structured piste objects */
function parseElements(elements) {
  const pistes = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const ref = tags["piste:ref"] ?? tags.ref ?? null;
    const name = tags["piste:name"] ?? tags.name ?? null;
    const difficulty = tags["piste:difficulty"] ?? null;

    if (el.type === "way" && el.geometry) {
      const geoPoints = el.geometry
        .filter((n) => n && n.lat != null && n.lon != null)
        .map((n) => ({ lat: n.lat, lng: n.lon }));
      if (geoPoints.length < 2) continue;
      pistes.push({
        osmId: `way/${el.id}`,
        type: "way",
        ref,
        name,
        difficulty,
        geoPoints,
      });
    } else if (el.type === "relation" && el.members) {
      // Collect geometry from way members
      const ways = [];
      for (const member of el.members) {
        if (member.type === "way" && member.geometry) {
          const pts = member.geometry
            .filter((n) => n && n.lat != null && n.lon != null)
            .map((n) => ({ lat: n.lat, lng: n.lon }));
          if (pts.length < 2) continue;
          ways.push({
            role: member.role ?? "",
            geoPoints: pts,
          });
        }
      }
      if (ways.length > 0) {
        pistes.push({
          osmId: `relation/${el.id}`,
          type: "relation",
          ref,
          name,
          difficulty,
          ways,
        });
      }
    }
  }

  return pistes;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
