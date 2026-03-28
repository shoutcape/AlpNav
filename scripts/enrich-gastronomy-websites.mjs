#!/usr/bin/env node
// Enriches data.json with website URLs scraped from the intermaps detail pages.
// Usage: node scripts/enrich-gastronomy-websites.mjs <resort-id>

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const resortId = process.argv[2];
if (!resortId) {
  console.error("Usage: node scripts/enrich-gastronomy-websites.mjs <resort-id>");
  console.error("Available resorts: zillertal-arena, mayrhofner-bergbahnen");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, `../public/resorts/${resortId}/overlays/data.json`);

const RESORT_CONFIG = {
  "zillertal-arena": {
    clientKey: "zillertalarena",
  },
  "mayrhofner-bergbahnen": {
    clientKey: "mayrhofen",
  }
};

const config = RESORT_CONFIG[resortId];
if (!config) {
  console.error(`Unknown resort ID: ${resortId}`);
  process.exit(1);
}

function extractWebsite(html) {
  const buttonsStart = html.indexOf('class="buttons"');
  if (buttonsStart === -1) return undefined;
  const buttonsEnd = html.indexOf("</div>", buttonsStart);
  const section = html.slice(buttonsStart, buttonsEnd !== -1 ? buttonsEnd : undefined);
  const re = /href="(https?:\/\/(?!.*intermaps\.com)[^"]+)"/;
  const m = re.exec(section);
  return m ? m[1] : undefined;
}

async function fetchWebsite(id, categoryId) {
  const url = `https://zillertal.intermaps.com/${config.clientKey}/detail-info-best-of/${categoryId}/${id}?lang=en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlpNav enrichment script)" },
    });
    if (!res.ok) {
      console.warn(`  [${id}] HTTP ${res.status}`);
      return undefined;
    }
    const html = await res.text();
    return extractWebsite(html);
  } catch (err) {
    console.warn(`  [${id}] fetch error: ${err.message}`);
    return undefined;
  }
}

async function main() {
  let data;
  try {
    data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  } catch (err) {
    console.error(`Failed to read data.json for ${resortId}: ${err.message}`);
    process.exit(1);
  }

  const pois = [
    ...(data.pois?.["202"] ?? []),
    ...(data.pois?.["3001"] ?? []),
    ...(data.pois?.["3002"] ?? [])
  ];

  if (pois.length === 0) {
    console.error("No gastronomy POIs found in data.json");
    process.exit(1);
  }

  console.log(`Enriching ${pois.length} gastronomy POIs with website URLs...`);
  let enriched = 0;

  for (const poi of pois) {
    const id = poi.id;
    const categoryId = poi.popup?.["clients-sub-id"] || "202";
    if (!id) continue;
    process.stdout.write(`  [${id}] ${poi.popup?.title ?? ""} ...`);
    const website = await fetchWebsite(id, categoryId);
    if (website) {
      poi.popup = poi.popup ?? {};
      poi.popup.info = poi.popup.info ?? {};
      poi.popup.info.website = website;
      process.stdout.write(` ${website}\n`);
      enriched++;
    } else {
      process.stdout.write(` no website\n`);
    }
    // Small delay to be polite to the server
    await new Promise(r => setTimeout(r, 150));
  }

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`\nDone. Enriched ${enriched}/${pois.length} POIs. data.json updated.`);
}

main().catch(err => { console.error(err); process.exit(1); });
