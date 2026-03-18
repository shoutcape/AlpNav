import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESORT_ID = "zillertal-arena";
const PAGE_URL = "https://zillertal.intermaps.com/zillertalarena?lang=en";
const BASE_URL = "https://zillertal.intermaps.com";
const OUTPUT_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "resorts",
  RESORT_ID,
  "overlays",
);

const HEADERS = {
  Referer: PAGE_URL,
  "User-Agent": "Mozilla/5.0 (compatible; AlpNav overlay sync)",
};

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });

  await downloadFile(`${BASE_URL}/image/zillertalarena_srm/svg/R.svg`, path.join(OUTPUT_ROOT, "R.svg"));
  await downloadFile(`${BASE_URL}/image/zillertalarena_srm/svg/L.svg`, path.join(OUTPUT_ROOT, "L.svg"));
  await downloadFile(`${BASE_URL}/zillertalarena/data?lang=en`, path.join(OUTPUT_ROOT, "data.json"));
  await downloadFile(`${BASE_URL}/image/zillertalarena_srm/svg/text.svg`, path.join(OUTPUT_ROOT, "text.svg"));

  process.stdout.write(`Overlay files are available in ${OUTPUT_ROOT}\n`);
}

async function downloadFile(url, dest) {
  if (await fileExists(dest)) {
    process.stdout.write(`Already exists: ${path.basename(dest)}\n`);
    return;
  }

  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, bytes);
  process.stdout.write(`Downloaded: ${path.basename(dest)}\n`);
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
