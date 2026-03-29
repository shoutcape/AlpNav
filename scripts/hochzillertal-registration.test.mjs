import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const RESORT_ID = "hochzillertal-hochfugen-spieljoch";

test("registers Hochzillertal in sync scripts and resort catalog", async () => {
  const [packageJson, artworkScript, overlayScript, catalog] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("./download-artwork.mjs", import.meta.url), "utf8"),
    readFile(new URL("./download-overlays.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/resorts/catalog.ts", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"sync:hochzillertal"\s*:/, "expected package.json to expose sync:hochzillertal");
  assert.match(packageJson, /"enrich:hochzillertal"\s*:/, "expected package.json to expose enrich:hochzillertal");
  assert.match(artworkScript, new RegExp(`"${RESORT_ID}"\\s*:\\s*\\{[^}]*intermapsId:\\s*"hochzillertal_spieljoch"`, "s"), "expected artwork downloader to include Hochzillertal config");
  assert.match(overlayScript, new RegExp(`"${RESORT_ID}"\\s*:\\s*\\{[^}]*intermapsId:\\s*"hochzillertal_spieljoch"[^}]*imagePath:\\s*"hochzillertal_spieljoch_srm"`, "s"), "expected overlay downloader to include Hochzillertal config");
  assert.match(catalog, new RegExp(`id:\\s*"${RESORT_ID}"[\\s\\S]*availability:\\s*"available"`, "s"), "expected Hochzillertal to be marked available in the resort catalog");
});

test("registers Hochzillertal in enrichment scripts", async () => {
  const [liftEnrichment, gastronomyImages, gastronomyWebsites] = await Promise.all([
    readFile(new URL("./enrich-lift-info.mjs", import.meta.url), "utf8"),
    readFile(new URL("./enrich-gastronomy-images.mjs", import.meta.url), "utf8"),
    readFile(new URL("./enrich-gastronomy-websites.mjs", import.meta.url), "utf8"),
  ]);

  const expectedConfig = new RegExp(`"${RESORT_ID}"\\s*:\\s*\\{[^}]*clientKey:\\s*"hochzillertal_spieljoch"`, "s");

  assert.match(liftEnrichment, expectedConfig, "expected lift enrichment to include Hochzillertal client config");
  assert.match(gastronomyImages, expectedConfig, "expected gastronomy image enrichment to include Hochzillertal client config");
  assert.match(gastronomyWebsites, expectedConfig, "expected gastronomy website enrichment to include Hochzillertal client config");
});

test("provides a local text overlay fallback for Hochzillertal", async () => {
  const textSvgPath = new URL("../public/resorts/hochzillertal-hochfugen-spieljoch/overlays/text.svg", import.meta.url);
  await assert.doesNotReject(() => access(textSvgPath));

  const textSvg = await readFile(textSvgPath, "utf8");
  assert.match(textSvg, /<text\b/, "expected Hochzillertal text overlay to contain label text nodes");
});

test("parser guards against suspicious long slope numbers when the title has a piste prefix", async () => {
  const parserSource = await readFile(new URL("../src/lib/resorts/intermaps/parser.ts", import.meta.url), "utf8");

  assert.match(
    parserSource,
    /const\s+suspiciousLongNumber\s*=\s*typeof\s+rawNumber\s*===\s*"string"\s*&&\s*\/\^\\d\{5,\}\$\/\.test\(rawNumber\)/,
    "expected parser to detect suspicious long numeric slope numbers",
  );
  assert.match(
    parserSource,
    /if\s*\(namePrefixMatch\)\s*\{[\s\S]*if\s*\(!rawNumber\s*\|\|\s*suspiciousLongNumber\s*\|\|\s*namePrefixMatch\[1\]\.startsWith\(rawNumber\)\)/,
    "expected parser to prefer the title prefix for suspicious long slope numbers like Hochzillertal's 1a Moesl",
  );
});

test("parser includes Hochzillertal webcam category 2809", async () => {
  const [parserSource, hochzillertalData] = await Promise.all([
    readFile(new URL("../src/lib/resorts/intermaps/parser.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/resorts/hochzillertal-hochfugen-spieljoch/overlays/data.json", import.meta.url), "utf8"),
  ]);

  const data = JSON.parse(hochzillertalData);
  assert.equal(data.pois["2809"].length, 4, "expected Hochzillertal source data to contain 4 webcams in category 2809");
  assert.match(
    parserSource,
    /"2809"/,
    "expected parser to reference webcam category 2809",
  );
});
