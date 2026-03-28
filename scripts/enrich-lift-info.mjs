#!/usr/bin/env node
// Enriches data.json with gallery images and opening hours scraped from intermaps lift detail pages.
// Usage: node scripts/enrich-lift-info.mjs <resort-id>

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const resortId = process.argv[2];
if (!resortId) {
  console.error("Usage: node scripts/enrich-lift-info.mjs <resort-id>");
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

function extractGalleryImages(html) {
  const imgs = [];
  const galleryStart = html.indexOf('class="gallery"');
  if (galleryStart === -1) return imgs;
  const galleryEnd = html.indexOf("</section>", galleryStart);
  const galleryHtml = galleryEnd !== -1 ? html.slice(galleryStart, galleryEnd) : html.slice(galleryStart);

  const imgRe = /<img[^>]+src="([^"]+)"/g;
  let match;
  while ((match = imgRe.exec(galleryHtml)) !== null) {
    const src = match[1];
    if (src && !src.includes("placeholder") && !src.includes("data:") && !/\/icon_/i.test(src)) {
      imgs.push(src);
    }
  }
  return imgs;
}

function extractOpeningHours(html) {
  // Look for opening-hours-from / opening-hours-to data attributes or text
  const fromMatch = /opening-hours-from['":\s]+([0-9:]+)/i.exec(html);
  const toMatch = /opening-hours-to['":\s]+([0-9:]+)/i.exec(html);
  if (fromMatch && toMatch) {
    return { from: fromMatch[1], to: toMatch[1] };
  }
  // Fallback: look for common time pattern text like "09:00 - 16:30"
  const timeRangeMatch = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(html);
  if (timeRangeMatch) {
    return { from: timeRangeMatch[1], to: timeRangeMatch[2] };
  }
  return null;
}

async function fetchLiftDetail(oid, categoryId) {
  const url = `https://zillertal.intermaps.com/${config.clientKey}/detail-info-best-of/${categoryId}/${oid}?lang=en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlpNav enrichment script)" },
    });
    if (!res.ok) {
      console.warn(`  [${oid}] HTTP ${res.status}`);
      return { imgs: [], openingHours: null };
    }
    const html = await res.text();
    const imgs = extractGalleryImages(html);
    const openingHours = extractOpeningHours(html);
    return { imgs, openingHours };
  } catch (err) {
    console.warn(`  [${oid}] fetch error: ${err.message}`);
    return { imgs: [], openingHours: null };
  }
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const lifts = data.lifts;
  if (!Array.isArray(lifts)) {
    console.error("No lifts array found in data.json");
    process.exit(1);
  }

  console.log(`Enriching ${lifts.length} lifts...`);
  let enriched = 0;

  for (const lift of lifts) {
    const oid = lift.popup?.oid;
    const categoryId = lift.popup?.["clients-sub-id"] || "1";
    if (!oid) {
      console.warn(`  [${lift.id}] no oid, skipping`);
      continue;
    }
    process.stdout.write(`  [${oid}] ${lift.popup?.title ?? lift.id} ...`);
    const { imgs, openingHours } = await fetchLiftDetail(oid, categoryId);

    let updated = false;
    if (imgs.length > 0) {
      lift.popup = lift.popup ?? {};
      lift.popup.info = lift.popup.info ?? {};
      lift.popup.info.imgs = imgs;
      updated = true;
    }
    if (openingHours) {
      lift.popup = lift.popup ?? {};
      lift.popup.info = lift.popup.info ?? {};
      lift.popup.info["opening-hours-from"] = openingHours.from;
      lift.popup.info["opening-hours-to"] = openingHours.to;
      updated = true;
    }

    if (updated) {
      const parts = [];
      if (imgs.length > 0) parts.push(`${imgs.length} image(s)`);
      if (openingHours) parts.push(`hours ${openingHours.from}–${openingHours.to}`);
      process.stdout.write(` ${parts.join(", ")}\n`);
      enriched++;
    } else {
      process.stdout.write(` no data\n`);
    }

    await new Promise(r => setTimeout(r, 150));
  }

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`\nDone. Enriched ${enriched}/${lifts.length} lifts. data.json updated.`);
}

main().catch(err => { console.error(err); process.exit(1); });
