import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESORT_ID = "zillertal-arena";
const PAGE_URL = "https://zillertal.intermaps.com/zillertalarena?lang=en";
const TILE_TEMPLATE = "https://s3-eu-west-1.amazonaws.com/intermaps-lynx/zillertalarena/pano/{z}/pano_{x}_{y}.jpg";
const REMOTE_BASE_ZOOM = 17;
const TILE_SIZE = 256;
const OUTPUT_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "resorts",
  RESORT_ID,
  "panorama",
);

async function main() {
  const zoomLevels = await fetchZoomLevels();
  const manifest = {
    resortId: RESORT_ID,
    pageUrl: PAGE_URL,
    tileSize: TILE_SIZE,
    remoteBaseZoom: REMOTE_BASE_ZOOM,
    localTemplate: "/resorts/zillertal-arena/panorama/{z}/pano_{x}_{y}.jpg",
    levels: [],
  };

  await mkdir(OUTPUT_ROOT, { recursive: true });

  for (const [index, level] of zoomLevels.entries()) {
    const remoteZoom = REMOTE_BASE_ZOOM + index;
    const columns = Math.ceil(level.size[0] / TILE_SIZE);
    const rows = Math.ceil(level.size[1] / TILE_SIZE);
    const levelDir = path.join(OUTPUT_ROOT, String(remoteZoom));

    await mkdir(levelDir, { recursive: true });

    manifest.levels.push({
      localIndex: index,
      remoteZoom,
      width: level.size[0],
      height: level.size[1],
      columns,
      rows,
    });

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const tileUrl = TILE_TEMPLATE
          .replace("{z}", String(remoteZoom))
          .replace("{x}", String(x))
          .replace("{y}", String(y));
        const tilePath = path.join(levelDir, `pano_${x}_${y}.jpg`);

        if (await fileExists(tilePath)) {
          continue;
        }

        const response = await fetch(tileUrl, {
          headers: {
            Referer: PAGE_URL,
            "User-Agent": "Mozilla/5.0 (compatible; AlpNav artwork sync)",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to download ${tileUrl}: ${response.status} ${response.statusText}`);
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(tilePath, bytes);
        process.stdout.write(`Downloaded z${remoteZoom} (${x},${y})\n`);
      }
    }
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
