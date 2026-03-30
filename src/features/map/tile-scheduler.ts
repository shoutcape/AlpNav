import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import type { PanoramaLevel, PanoramaManifest } from "./types";
import type { TileDescriptor } from "./tile-types";

const MAX_CONCURRENCY = 6;
const DEBOUNCE_MS = 80;

type TileSchedulerOptions = {
  manifest: PanoramaManifest;
  maxLevel: PanoramaLevel;
  levels: PanoramaLevel[];
  levelTiles: Map<number, TileDescriptor[]>;
  tileLayer: Container;
  levelContainers: Map<number, Container>;
  loadedLevels: Set<number>;
  baseZoom: number;
  onLevelReady: (zoom: number) => void;
};

type QueueEntry = {
  tile: TileDescriptor;
  zoom: number;
  distance: number;
};

export class TileScheduler {
  private manifest: PanoramaManifest;
  private maxLevel: PanoramaLevel;
  private levels: PanoramaLevel[];
  private levelTiles: Map<number, TileDescriptor[]>;
  private tileLayer: Container;
  private levelContainers: Map<number, Container>;
  private loadedLevels: Set<number>;
  private baseZoom: number;
  private onLevelReady: (zoom: number) => void;

  private loadedTileKeys = new Set<string>();
  private cancelledKeys = new Set<string>();
  private inflightKeys = new Set<string>();
  private queue: QueueEntry[] = [];
  private disposed = false;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingViewport: Viewport | null = null;
  private hasRunOnce = false;

  // Track visible tile counts per level for completion detection
  private visibleCountByZoom = new Map<number, number>();

  constructor(options: TileSchedulerOptions) {
    this.manifest = options.manifest;
    this.maxLevel = options.maxLevel;
    this.levels = options.levels;
    this.levelTiles = options.levelTiles;
    this.tileLayer = options.tileLayer;
    this.levelContainers = options.levelContainers;
    this.loadedLevels = options.loadedLevels;
    this.baseZoom = options.baseZoom;
    this.onLevelReady = options.onLevelReady;
  }

  /** Call on every viewport "moved" event. Internally debounced. */
  scheduleUpdate(viewport: Viewport): void {
    if (this.disposed) return;

    this.pendingViewport = viewport;

    if (this.debounceTimer !== null) return;

    // Leading edge: run immediately on first call
    if (!this.hasRunOnce) {
      this.hasRunOnce = true;
      this.update(viewport);
    }

    // Schedule trailing edge
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.pendingViewport && !this.disposed) {
        this.update(this.pendingViewport);
        this.pendingViewport = null;
      }
    }, DEBOUNCE_MS);
  }

  private update(viewport: Viewport): void {
    // Compute viewport bounds in world coordinates
    const viewLeft = -viewport.x / viewport.scale.x;
    const viewTop = -viewport.y / viewport.scale.y;
    const viewRight = viewLeft + viewport.screenWidth / viewport.scale.x;
    const viewBottom = viewTop + viewport.screenHeight / viewport.scale.y;
    const centerX = (viewLeft + viewRight) / 2;
    const centerY = (viewTop + viewBottom) / 2;

    // Determine which levels to load
    const projectedWidth = this.maxLevel.width * viewport.scale.x;
    const targetLevels = getTargetLevels(this.levels, projectedWidth, this.baseZoom);

    // Compute needed tiles across target levels
    const neededKeys = new Set<string>();
    const newEntries: QueueEntry[] = [];

    for (const level of targetLevels) {
      const tiles = this.levelTiles.get(level.remoteZoom);
      if (!tiles) continue;

      // Buffer = 1 tile in world coords for this level
      const scale = this.maxLevel.width / level.width;
      const buffer = this.manifest.tileSize * scale;

      const visible = computeVisibleTiles(tiles, viewLeft, viewTop, viewRight, viewBottom, buffer);
      this.visibleCountByZoom.set(level.remoteZoom, visible.length);

      for (const tile of visible) {
        neededKeys.add(tile.key);

        if (this.loadedTileKeys.has(tile.key) || this.inflightKeys.has(tile.key)) {
          continue;
        }

        const dx = (tile.left + tile.width / 2) - centerX;
        const dy = (tile.top + tile.height / 2) - centerY;
        newEntries.push({ tile, zoom: level.remoteZoom, distance: dx * dx + dy * dy });
      }
    }

    // Cancel inflight loads that are no longer needed
    for (const key of this.inflightKeys) {
      if (!neededKeys.has(key)) {
        this.cancelledKeys.add(key);
      }
    }

    // Rebuild queue sorted by distance (center-first)
    this.queue = newEntries.sort((a, b) => a.distance - b.distance);

    this.drainQueue();
  }

  private drainQueue(): void {
    while (this.inflightKeys.size < MAX_CONCURRENCY && this.queue.length > 0) {
      const entry = this.queue.shift()!;

      // Skip if already loaded or cancelled since queueing
      if (this.loadedTileKeys.has(entry.tile.key) || this.disposed) continue;

      this.loadTile(entry.tile, entry.zoom);
    }
  }

  private loadTile(tile: TileDescriptor, zoom: number): void {
    this.inflightKeys.add(tile.key);

    Assets.load(tile.src)
      .then(() => {
        this.inflightKeys.delete(tile.key);

        if (this.disposed) return;

        // Check if this tile was cancelled during load
        if (this.cancelledKeys.has(tile.key)) {
          this.cancelledKeys.delete(tile.key);
          this.drainQueue();
          return;
        }

        // Create sprite and add to level container
        const container = this.ensureLevelContainer(zoom);
        const fullTexture = Assets.get<Texture>(tile.src);
        const croppedTexture = new Texture({
          source: fullTexture.source,
          frame: new Rectangle(0, 0, tile.srcWidth, tile.srcHeight),
        });
        const sprite = new Sprite(croppedTexture);
        sprite.x = tile.left;
        sprite.y = tile.top;
        sprite.width = tile.width;
        sprite.height = tile.height;
        container.addChild(sprite);

        this.loadedTileKeys.add(tile.key);

        // Check if level is complete for visible area
        this.checkLevelCompletion(zoom);

        this.drainQueue();
      })
      .catch(() => {
        // Network error — tile will be retried on next update cycle
        this.inflightKeys.delete(tile.key);
        this.cancelledKeys.delete(tile.key);
        this.drainQueue();
      });
  }

  private ensureLevelContainer(zoom: number): Container {
    let container = this.levelContainers.get(zoom);
    if (container) return container;

    container = new Container();
    container.label = `panorama-level-${zoom}`;
    container.alpha = 0;
    this.tileLayer.addChild(container);
    this.levelContainers.set(zoom, container);
    return container;
  }

  private checkLevelCompletion(zoom: number): void {
    if (this.loadedLevels.has(zoom)) return;

    const tiles = this.levelTiles.get(zoom);
    if (!tiles) return;

    const visibleCount = this.visibleCountByZoom.get(zoom) ?? 0;
    let loadedVisible = 0;
    for (const tile of tiles) {
      if (this.loadedTileKeys.has(tile.key)) {
        loadedVisible++;
      }
    }

    // Mark level ready when all visible tiles are loaded
    if (loadedVisible >= visibleCount && visibleCount > 0) {
      this.onLevelReady(zoom);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.queue = [];
    this.inflightKeys.clear();
    this.cancelledKeys.clear();
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/** Returns tiles whose world-space rectangles overlap the viewport + buffer. */
function computeVisibleTiles(
  tiles: TileDescriptor[],
  viewLeft: number,
  viewTop: number,
  viewRight: number,
  viewBottom: number,
  buffer: number,
): TileDescriptor[] {
  const bl = viewLeft - buffer;
  const bt = viewTop - buffer;
  const br = viewRight + buffer;
  const bb = viewBottom + buffer;

  return tiles.filter((tile) => {
    const tileRight = tile.left + tile.width;
    const tileBottom = tile.top + tile.height;
    return tile.left < br && tileRight > bl && tile.top < bb && tileBottom > bt;
  });
}

/**
 * Determines which zoom levels to load based on current viewport scale.
 * Returns 0-2 non-base levels whose tiles should be loaded.
 *
 * The blend logic in applyLevelBlend fades between adjacent levels:
 *   fadeStart = lower.width * 0.75
 *   fadeEnd   = lower.width
 * So a level becomes relevant when projectedWidth approaches its range.
 * We preload slightly earlier (at 0.6x) to have tiles ready before the blend starts.
 */
function getTargetLevels(
  levels: PanoramaLevel[],
  projectedWidth: number,
  baseZoom: number,
): PanoramaLevel[] {
  const nonBase = levels.filter((l) => l.remoteZoom !== baseZoom);
  if (nonBase.length === 0) return [];

  // Find the highest non-base level whose "preload threshold" has been reached.
  // Preload threshold = level.width * 0.6 (earlier than the 0.75 blend start).
  let activeIndex = -1;
  for (let i = 0; i < nonBase.length; i++) {
    if (projectedWidth >= nonBase[i].width * 0.6) {
      activeIndex = i;
    }
  }

  if (activeIndex === -1) return [];

  const targets = [nonBase[activeIndex]];

  // Also include the next level up if we're approaching the transition zone
  if (activeIndex + 1 < nonBase.length) {
    const next = nonBase[activeIndex + 1];
    if (projectedWidth >= next.width * 0.6) {
      targets.push(next);
    }
  }

  return targets;
}
