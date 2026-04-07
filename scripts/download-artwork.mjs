import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIGS = {
  "zillertal-arena": {
    intermapsId: "zillertalarena",
    remoteBaseZoom: 16,
  },
  "mayrhofner-bergbahnen": {
    intermapsId: "mayrhofen",
    remoteBaseZoom: 16,
  },
  "hochzillertal-hochfugen-spieljoch": {
    intermapsId: "hochzillertal_spieljoch",
    remoteBaseZoom: 16,
  },
  "hintertuxer-gletscher": {
    intermapsId: "hintertuxer_gletscher",
    remoteBaseZoom: 17,
  },
};

const resortId = process.argv[2];
if (!resortId || !CONFIGS[resortId]) {
  console.error("Usage: node download-artwork.mjs <resort-id>");
  console.error(`Available resorts: ${Object.keys(CONFIGS).join(", ")}`);
  process.exit(1);
}

const config = CONFIGS[resortId];
const PAGE_URL = `https://zillertal.intermaps.com/${config.intermapsId}?lang=en`;
const TILE_TEMPLATE = `https://s3-eu-west-1.amazonaws.com/intermaps-lynx/${config.intermapsId}/pano/{z}/pano_{x}_{y}.jpg`;
const TILE_SIZE = 256;
const OUTPUT_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "resorts",
  resortId,
  "panorama",
);

async function main() {
  const zoomLevels = await fetchZoomLevels();
  const manifest = {
    resortId: resortId,
    pageUrl: PAGE_URL,
    tileSize: TILE_SIZE,
    remoteBaseZoom: config.remoteBaseZoom,
    localTemplate: `/resorts/${resortId}/panorama/{z}/pano_{x}_{y}.webp`,
    levels: [],
  };

  await mkdir(OUTPUT_ROOT, { recursive: true });

  for (const [index, level] of zoomLevels.entries()) {
    const remoteZoom = config.remoteBaseZoom + index;
    const columns = Math.ceil(level.size[0] / TILE_SIZE);
    const rows = Math.ceil(level.size[1] / TILE_SIZE);
    manifest.levels.push({
      localIndex: index,
      remoteZoom,
      width: level.size[0],
      height: level.size[1],
      columns,
      rows,
    });
  }

  let tilesInaccessible = false;

  outer: for (const level of manifest.levels) {
    const { remoteZoom, columns, rows } = level;
    const levelDir = path.join(OUTPUT_ROOT, String(remoteZoom));

    await mkdir(levelDir, { recursive: true });

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const tileUrl = TILE_TEMPLATE
          .replace("{z}", String(remoteZoom))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        const tilePath = path.join(levelDir, `pano_${x}_${y}.jpg`);
        const webpPath = path.join(levelDir, `pano_${x}_${y}.webp`);

        if (await fileExists(tilePath) || await fileExists(webpPath)) {
          continue;
        }

        const response = await fetch(tileUrl, {
          headers: {
            Referer: PAGE_URL,
            "User-Agent": "Mozilla/5.0 (compatible; AlpNav artwork sync)",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            console.warn(`WARNING: Tile ${tileUrl} is not publicly accessible (403). Skipping tile download — manifest will still be written.`);
            tilesInaccessible = true;
            break outer;
          }
          throw new Error(`Failed to download ${tileUrl}: ${response.status} ${response.statusText}`);
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(tilePath, bytes);
        process.stdout.write(`Downloaded ${resortId} z${remoteZoom} (${x},${y})\n`);
      }
    }
  }

  if (tilesInaccessible) {
    console.warn(`WARNING: No panorama tiles were downloaded for ${resortId}. The map will render without a background image.`);
  }

  await writeFile(
    path.join(OUTPUT_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stdout.write(`Panorama artwork is available in ${OUTPUT_ROOT}\n`);
}

async function fetchZoomLevels() {
  const response = await fetch(PAGE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AlpNav artwork sync)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${PAGE_URL}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(/config = (\{[\s\S]*?\});/);

  if (!match) {
    throw new Error("Could not locate reference map config in page HTML.");
  }

  const config = JSON.parse(match[1]);

  if (!Array.isArray(config.zoomLevels) || config.zoomLevels.length === 0) {
    throw new Error("Reference map config does not include zoomLevels.");
  }

  return config.zoomLevels;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
