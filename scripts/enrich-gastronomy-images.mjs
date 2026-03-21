#!/usr/bin/env node
// Enriches data.json with gallery images scraped from the intermaps detail pages.
// Run once: node scripts/enrich-gastronomy-images.mjs

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "../public/resorts/zillertal-arena/overlays/data.json");
const BASE_URL = "https://zillertal.intermaps.com/zillertalarena/detail-info-best-of/202";

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

async function fetchImages(id) {
  const url = `${BASE_URL}/${id}?lang=en`;
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
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const pois = data.pois?.["202"];
  if (!Array.isArray(pois)) {
    console.error("No pois['202'] array found in data.json");
    process.exit(1);
  }

  console.log(`Enriching ${pois.length} gastronomy POIs...`);
  let enriched = 0;

  for (const poi of pois) {
    const id = poi.id;
    if (!id) continue;
    process.stdout.write(`  [${id}] ${poi.popup?.title ?? ""} ...`);
    const imgs = await fetchImages(id);
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
