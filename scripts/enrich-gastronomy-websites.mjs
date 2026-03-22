#!/usr/bin/env node
// Enriches data.json with website URLs scraped from the intermaps detail pages.
// Run once: node scripts/enrich-gastronomy-websites.mjs

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "../public/resorts/zillertal-arena/overlays/data.json");
const BASE_URL = "https://zillertal.intermaps.com/zillertalarena/detail-info-best-of/202";

function extractWebsite(html) {
  const buttonsStart = html.indexOf('class="buttons"');
  if (buttonsStart === -1) return undefined;
  const buttonsEnd = html.indexOf("</div>", buttonsStart);
  const section = html.slice(buttonsStart, buttonsEnd !== -1 ? buttonsEnd : undefined);
  const re = /href="(https?:\/\/(?!.*intermaps\.com)[^"]+)"/;
  const m = re.exec(section);
  return m ? m[1] : undefined;
}

async function fetchWebsite(id) {
  const url = `${BASE_URL}/${id}?lang=en`;
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
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const pois = data.pois?.["202"];
  if (!Array.isArray(pois)) {
    console.error("No pois['202'] array found in data.json");
    process.exit(1);
  }

  console.log(`Enriching ${pois.length} gastronomy POIs with website URLs...`);
  let enriched = 0;

  for (const poi of pois) {
    const id = poi.id;
    if (!id) continue;
    process.stdout.write(`  [${id}] ${poi.popup?.title ?? ""} ...`);
    const website = await fetchWebsite(id);
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
