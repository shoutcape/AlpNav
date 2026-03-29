import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIGS = {
  "zillertal-arena": {
    intermapsId: "zillertalarena",
    imagePath: "zillertalarena_srm",
  },
  "mayrhofner-bergbahnen": {
    intermapsId: "mayrhofen",
    imagePath: "mayrhofen",
  },
  "hochzillertal-hochfugen-spieljoch": {
    intermapsId: "hochzillertal_spieljoch",
    imagePath: "hochzillertal_spieljoch_srm",
  },
  "ski-gletscherwelt-zillertal-3000": {
    intermapsId: "zillertal_3000",
    imagePath: "zillertal_3000",
  },
};

const resortId = process.argv[2];
if (!resortId || !CONFIGS[resortId]) {
  console.error("Usage: node download-overlays.mjs <resort-id>");
  console.error(`Available resorts: ${Object.keys(CONFIGS).join(", ")}`);
  process.exit(1);
}

const config = CONFIGS[resortId];
const PAGE_URL = `https://zillertal.intermaps.com/${config.intermapsId}?lang=en`;
const BASE_URL = "https://zillertal.intermaps.com";
const OUTPUT_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "resorts",
  resortId,
  "overlays",
);

const HEADERS = {
  Referer: PAGE_URL,
  "User-Agent": "Mozilla/5.0 (compatible; AlpNav overlay sync)",
};

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });

  await downloadFile(`${BASE_URL}/image/${config.imagePath}/svg/R.svg`, path.join(OUTPUT_ROOT, "R.svg"));
  await downloadFile(`${BASE_URL}/image/${config.imagePath}/svg/L.svg`, path.join(OUTPUT_ROOT, "L.svg"));
  await downloadFile(`${BASE_URL}/${config.intermapsId}/data?lang=en`, path.join(OUTPUT_ROOT, "data.json"));
  await downloadTextOverlay(path.join(OUTPUT_ROOT, "text.svg"));

  process.stdout.write(`Overlay files are available in ${OUTPUT_ROOT}\n`);
}

async function downloadTextOverlay(dest) {
  if (await hasUsableTextOverlay(dest)) {
    process.stdout.write(`Already exists: ${path.basename(dest)}\n`);
    return;
  }

  const candidates = [
    `${BASE_URL}/image/${config.imagePath}/svg/text.svg`,
    `${BASE_URL}/image/${config.imagePath}/svg/text+logos.svg`,
  ];

  for (const url of candidates) {
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }

      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(dest, bytes);
    process.stdout.write(`Downloaded: ${path.basename(dest)} from ${path.basename(url)}\n`);
    return;
  }

  await writeFile(dest, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n');
  console.warn("WARNING: Missing text overlay SVGs, created empty text.svg fallback");
}

async function downloadFile(url, dest) {
  if (await fileExists(dest)) {
    process.stdout.write(`Already exists: ${path.basename(dest)}\n`);
    return;
  }

  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    if (response.status === 404) {
      if (path.basename(dest) === "text.svg") {
        await writeFile(dest, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n');
        console.warn(`WARNING: Missing file ${url}, created empty text.svg fallback`);
        return;
      }

      console.warn(`WARNING: Missing file ${url}, continuing...`);
      return;
     }
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, bytes);
  process.stdout.write(`Downloaded: ${path.basename(dest)}\n`);
}

async function hasUsableTextOverlay(filePath) {
  if (!(await fileExists(filePath))) {
    return false;
  }

  const content = await readFile(filePath, "utf8");
  return content.includes("<text");
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
