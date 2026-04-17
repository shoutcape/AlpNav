import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Viewport } from "pixi-viewport";

vi.mock("pixi.js", () => {
  class Container {
    addChild = vi.fn();
    label = "";
    alpha = 0;
  }
  return {
    Assets: { load: vi.fn(), get: vi.fn() },
    Container,
    Rectangle: class {},
    Sprite: class {},
    Texture: class {},
  };
});

import { Assets, Container } from "pixi.js";
import { computeVisibleTiles, getTargetLevels, TileScheduler } from "./tile-scheduler";
import { buildTileUrl, createTileDescriptors } from "./tile-types";
import type { TileDescriptor } from "./tile-types";
import type { PanoramaLevel, PanoramaManifest } from "./types";

// ── buildTileUrl ──────────────────────────────────────────────

describe("buildTileUrl", () => {
  it("replaces {z}, {x}, {y} placeholders", () => {
    const template = "/tiles/{z}/{x}/{y}.webp";
    expect(buildTileUrl(template, 3, 1, 2)).toBe("/tiles/3/1/2.webp");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const template = "{z}-{z}/{x}/{y}";
    expect(buildTileUrl(template, 5, 0, 0)).toBe("5-5/0/0");
  });
});

// ── createTileDescriptors ─────────────────────────────────────

describe("createTileDescriptors", () => {
  const manifest: PanoramaManifest = {
    resortId: "test",
    pageUrl: "https://example.com",
    tileSize: 256,
    remoteBaseZoom: 0,
    localTemplate: "/tiles/{z}/{x}/{y}.webp",
    levels: [],
  };

  const maxLevel: PanoramaLevel = {
    localIndex: 2,
    remoteZoom: 4,
    width: 1024,
    height: 512,
    columns: 4,
    rows: 2,
  };

  it("creates correct number of tiles", () => {
    const level: PanoramaLevel = {
      localIndex: 1,
      remoteZoom: 3,
      width: 512,
      height: 256,
      columns: 2,
      rows: 1,
    };
    const tiles = createTileDescriptors(manifest, level, maxLevel);
    expect(tiles).toHaveLength(2); // 2 columns × 1 row
  });

  it("scales tile positions to max level coordinate space", () => {
    const level: PanoramaLevel = {
      localIndex: 0,
      remoteZoom: 2,
      width: 512,
      height: 256,
      columns: 2,
      rows: 1,
    };
    // scale = maxLevel.width / level.width = 1024 / 512 = 2
    const tiles = createTileDescriptors(manifest, level, maxLevel);
    expect(tiles[0].left).toBe(0);
    expect(tiles[0].width).toBe(512); // 256 * 2
    expect(tiles[1].left).toBe(512); // 256 * 2
  });

  it("clips edge tiles to actual image dimensions", () => {
    // 300px wide with 256 tile size → first tile 256, second tile 44
    const level: PanoramaLevel = {
      localIndex: 0,
      remoteZoom: 2,
      width: 300,
      height: 200,
      columns: 2,
      rows: 1,
    };
    const tiles = createTileDescriptors(manifest, level, maxLevel);
    expect(tiles[0].srcWidth).toBe(256);
    expect(tiles[1].srcWidth).toBe(44); // 300 - 256
  });

  it("generates correct keys", () => {
    const level: PanoramaLevel = {
      localIndex: 0,
      remoteZoom: 3,
      width: 512,
      height: 256,
      columns: 2,
      rows: 1,
    };
    const tiles = createTileDescriptors(manifest, level, maxLevel);
    expect(tiles[0].key).toBe("3-0-0");
    expect(tiles[1].key).toBe("3-1-0");
  });
});

// ── computeVisibleTiles ───────────────────────────────────────

describe("computeVisibleTiles", () => {
  const tiles: TileDescriptor[] = [
    { key: "0-0", src: "", left: 0, top: 0, width: 100, height: 100, srcWidth: 100, srcHeight: 100 },
    { key: "1-0", src: "", left: 100, top: 0, width: 100, height: 100, srcWidth: 100, srcHeight: 100 },
    { key: "2-0", src: "", left: 200, top: 0, width: 100, height: 100, srcWidth: 100, srcHeight: 100 },
    { key: "0-1", src: "", left: 0, top: 100, width: 100, height: 100, srcWidth: 100, srcHeight: 100 },
  ];

  it("returns tiles overlapping the viewport", () => {
    // viewport covers 0-150 x 0-50 → should see tiles at (0,0) and (100,0)
    const visible = computeVisibleTiles(tiles, 0, 0, 150, 50, 0);
    expect(visible.map((t) => t.key)).toEqual(["0-0", "1-0"]);
  });

  it("includes tiles within buffer distance", () => {
    // viewport is 160-250, buffer of 50 extends to 110-300 → should catch tile at (100,0)
    const visible = computeVisibleTiles(tiles, 160, 0, 250, 50, 50);
    expect(visible.map((t) => t.key)).toContain("1-0");
  });

  it("returns empty for viewport outside all tiles", () => {
    const visible = computeVisibleTiles(tiles, 500, 500, 600, 600, 0);
    expect(visible).toHaveLength(0);
  });

  it("returns all tiles when viewport covers everything", () => {
    const visible = computeVisibleTiles(tiles, -10, -10, 400, 300, 0);
    expect(visible).toHaveLength(4);
  });
});

// ── getTargetLevels ───────────────────────────────────────────

describe("getTargetLevels", () => {
  const baseZoom = 2;
  const levels: PanoramaLevel[] = [
    { localIndex: 0, remoteZoom: 2, width: 500, height: 250, columns: 2, rows: 1 },
    { localIndex: 1, remoteZoom: 3, width: 1000, height: 500, columns: 4, rows: 2 },
    { localIndex: 2, remoteZoom: 4, width: 2000, height: 1000, columns: 8, rows: 4 },
  ];

  it("returns empty when projected width is below all thresholds", () => {
    // threshold for level 3 = 1000 * 0.6 = 600. projected = 500 → below
    const result = getTargetLevels(levels, 500, baseZoom);
    expect(result).toHaveLength(0);
  });

  it("returns the active level when threshold is met", () => {
    // threshold for level 3 = 600. projected = 700 → level 3 active
    const result = getTargetLevels(levels, 700, baseZoom);
    expect(result).toHaveLength(1);
    expect(result[0].remoteZoom).toBe(3);
  });

  it("returns higher level when its threshold is met", () => {
    // threshold for level 4 = 2000 * 0.6 = 1200. projected = 1300 → both met
    const result = getTargetLevels(levels, 1300, baseZoom);
    expect(result.some((l) => l.remoteZoom === 4)).toBe(true);
  });

  it("excludes the base zoom level", () => {
    const result = getTargetLevels(levels, 5000, baseZoom);
    expect(result.every((l) => l.remoteZoom !== baseZoom)).toBe(true);
  });
});

// ── TileScheduler dispose ─────────────────────────────────────

describe("TileScheduler dispose", () => {
  const manifest: PanoramaManifest = {
    resortId: "test",
    pageUrl: "https://example.com",
    tileSize: 256,
    remoteBaseZoom: 2,
    localTemplate: "/tiles/{z}/{x}/{y}.webp",
    levels: [],
  };
  const baseLevel: PanoramaLevel = {
    localIndex: 0, remoteZoom: 2, width: 256, height: 256, columns: 1, rows: 1,
  };
  const nonBaseLevel: PanoramaLevel = {
    localIndex: 1, remoteZoom: 3, width: 512, height: 512, columns: 2, rows: 2,
  };
  const viewport = {
    x: 0, y: 0, scale: { x: 1, y: 1 }, screenWidth: 800, screenHeight: 600,
  } as unknown as Viewport;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(Assets.load).mockReset();
    vi.mocked(Assets.get).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks retry timers and clears them on dispose", async () => {
    vi.mocked(Assets.load).mockRejectedValue(new Error("fail"));

    const scheduler = new TileScheduler({
      manifest,
      maxLevel: nonBaseLevel,
      levels: [baseLevel, nonBaseLevel],
      levelTiles: new Map([[3, createTileDescriptors(manifest, nonBaseLevel, nonBaseLevel)]]),
      tileLayer: new Container() as unknown as import("pixi.js").Container,
      levelContainers: new Map(),
      loadedLevels: new Set(),
      baseZoom: 2,
      onLevelReady: vi.fn(),
    });

    scheduler.scheduleUpdate(viewport);
    // Flush the Assets.load rejection microtask so the catch block registers the retry timer.
    await vi.advanceTimersByTimeAsync(0);

    const retryTimers = scheduler["retryTimers"];
    expect(retryTimers.size).toBeGreaterThan(0);
    const loadCallsBeforeDispose = vi.mocked(Assets.load).mock.calls.length;

    scheduler.dispose();

    expect(retryTimers.size).toBe(0);

    // Advance past RETRY_DELAY_MS — the cleared timer must not fire.
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(Assets.load).mock.calls.length).toBe(loadCallsBeforeDispose);
  });
});
