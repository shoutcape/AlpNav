#!/usr/bin/env node
// Enriches data.json with gallery images scraped from the intermaps detail pages.
// Usage: node scripts/enrich-gastronomy-images.mjs <resort-id>

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const resortId = process.argv[2];
if (!resortId) {
  console.error("Usage: node scripts/enrich-gastronomy-images.mjs <resort-id>");
  console.error("Available resorts: zillertal-arena, mayrhofner-bergbahnen, hochzillertal-hochfugen-spieljoch");
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
  },
  "hochzillertal-hochfugen-spieljoch": {
    clientKey: "hochzillertal_spieljoch",
  },
  "hintertuxer-gletscher": {
    clientKey: "hintertuxer_gletscher",
  },
};

const config = RESORT_CONFIG[resortId];
if (!config) {
  console.error(`Unknown resort ID: ${resortId}`);
  process.exit(1);
}

function extractGalleryImages(html) {
  const imgs = [];
  // Find .gallery section
  const galleryStart = html.indexOf('class="gallery"');
  if (galleryStart === -1) return imgs;
  // Find closing </section> or </div> after gallery
  const galleryEnd = html.indexOf("</section>", galleryStart);
  const galleryHtml = galleryEnd !== -1 ? html.slice(galleryStart, galleryEnd) : html.slice(galleryStart);

  // Extract all img src attributes
  const imgRe = /<img[^>]+src="([^"]+)"/g;
  let match;
  while ((match = imgRe.exec(galleryHtml)) !== null) {
    const src = match[1];
    // Skip placeholder images and icons (e.g. phone/email icons from s3)
    if (src && !src.includes("placeholder") && !src.includes("data:") && !/\/icon_/i.test(src)) {
      imgs.push(src);
    }
  }
  return imgs;
}

async function fetchImages(id, categoryId) {
  const url = `https://zillertal.intermaps.com/${config.clientKey}/detail-info-best-of/${categoryId}/${id}?lang=en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlpNav enrichment script)" },
    });
    if (!res.ok) {
      console.warn(`  [${id}] HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();
    const imgs = extractGalleryImages(html);
    return imgs;
  } catch (err) {
    console.warn(`  [${id}] fetch error: ${err.message}`);
    return [];
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

  console.log(`Enriching ${pois.length} gastronomy POIs...`);
  let enriched = 0;

  for (const poi of pois) {
    const id = poi.id;
    const categoryId = poi.popup?.["clients-sub-id"] || "202";
    if (!id) continue;
    process.stdout.write(`  [${id}] ${poi.popup?.title ?? ""} ...`);
    const imgs = await fetchImages(id, categoryId);
    if (imgs.length > 0) {
      poi.popup = poi.popup ?? {};
      poi.popup.info = poi.popup.info ?? {};
      poi.popup.info.imgs = imgs;
      process.stdout.write(` ${imgs.length} image(s)\n`);
      enriched++;
    } else {
      process.stdout.write(` no gallery\n`);
    }
    // Small delay to be polite to the server
    await new Promise(r => setTimeout(r, 150));
  }

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`\nDone. Enriched ${enriched}/${pois.length} POIs. data.json updated.`);
}

main().catch(err => { console.error(err); process.exit(1); });
