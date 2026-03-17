"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Sprite } from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { PanoramaLevel, PanoramaManifest } from "./types";

type MapShellProps = {
  manifest: PanoramaManifest;
};

type TileDescriptor = {
  key: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type RenderMetrics = {
  zoom: number;
  activeLevel: PanoramaLevel;
};

export function MapShell({ manifest }: MapShellProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const levelContainersRef = useRef<Map<number, Container>>(new Map());
  const loadedLevelsRef = useRef<Set<number>>(new Set());
  const hasInteractedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [loadedLevelCount, setLoadedLevelCount] = useState(0);
  const [metrics, setMetrics] = useState<RenderMetrics | null>(null);

  const maxLevel = manifest.levels[manifest.levels.length - 1];
  const maxScale = useMemo(() => {
    if (typeof window === "undefined") {
      return 1;
    }

    return clamp(window.devicePixelRatio || 1, 1, 3);
  }, []);
  const levelTiles = useMemo(() => {
    return new Map(manifest.levels.map((level) => [level.remoteZoom, createTileDescriptors(manifest, level, maxLevel)]));
  }, [manifest, maxLevel]);

  useEffect(() => {
    const host = hostRef.current;
    const levelContainers = levelContainersRef.current;
    const loadedLevels = loadedLevelsRef.current;

    if (!host) {
      return;
    }

    let cancelled = false;

    const updateMetrics = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const activeLevel = pickLoadedBlendLevel(manifest.levels, loadedLevelsRef.current, maxLevel.width * viewport.scale.x);

      if (!activeLevel) {
        return;
      }

      setMetrics({
        zoom: Math.log2(viewport.scale.x),
        activeLevel,
      });
    };

    const scheduleMetricsUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateMetrics();
      });
    };

    const syncLevelBlend = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const projectedWidth = maxLevel.width * viewport.scale.x;
      applyLevelBlend(manifest.levels, levelContainersRef.current, loadedLevelsRef.current, projectedWidth);
      scheduleMetricsUpdate();
    };

    const syncViewportBounds = (shouldResetView: boolean) => {
      const viewport = viewportRef.current;

      if (!viewport || !host.clientWidth || !host.clientHeight) {
        return;
      }

      const minScale = computeMinScale(host.clientWidth, host.clientHeight, maxLevel.width, maxLevel.height);

      viewport.resize(host.clientWidth, host.clientHeight, maxLevel.width, maxLevel.height);
      viewport.clamp({ direction: "all", underflow: "center" });
      viewport.clampZoom({ minScale, maxScale });

      if (shouldResetView || !hasInteractedRef.current) {
        viewport.fitWorld(true);
        viewport.moveCenter(maxLevel.width / 2, maxLevel.height / 2);
      }

      syncLevelBlend();
    };

    const initialize = async () => {
      const app = new Application();

      await app.init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        preference: "webgl",
        resolution: window.devicePixelRatio || 1,
        resizeTo: host,
      });

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      host.appendChild(app.canvas);
      app.canvas.className = "h-full w-full touch-none";
      appRef.current = app;

      const viewport = new Viewport({
        screenWidth: host.clientWidth,
        screenHeight: host.clientHeight,
        worldWidth: maxLevel.width,
        worldHeight: maxLevel.height,
        events: app.renderer.events,
      });

      viewport.drag().pinch().wheel({ smooth: 6 }).decelerate();
      viewport.on("drag-start", () => {
        hasInteractedRef.current = true;
      });
      viewport.on("pinch-start", () => {
        hasInteractedRef.current = true;
      });
      viewport.on("wheel", () => {
        hasInteractedRef.current = true;
      });
      viewport.on("moved", syncLevelBlend);

      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      syncViewportBounds(true);

      const firstLevel = manifest.levels[0];
      await loadLevelIntoViewport(
        viewport,
        levelContainersRef.current,
        firstLevel,
        levelTiles.get(firstLevel.remoteZoom) ?? [],
      );

      if (cancelled) {
        return;
      }

      loadedLevelsRef.current.add(firstLevel.remoteZoom);
      setLoadedLevelCount(1);
      syncLevelBlend();

      for (const level of manifest.levels.slice(1)) {
        await loadLevelIntoViewport(viewport, levelContainersRef.current, level, levelTiles.get(level.remoteZoom) ?? []);

        if (cancelled) {
          return;
        }

        loadedLevelsRef.current.add(level.remoteZoom);
        setLoadedLevelCount(loadedLevelsRef.current.size);
        syncLevelBlend();
      }
    };

    initialize().catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
    });

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const nextSize = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };

      setContainerSize(nextSize);
      syncViewportBounds(false);
    });

    resizeObserverRef.current.observe(host);

    return () => {
      cancelled = true;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

        viewportRef.current?.destroy({ children: true });
        viewportRef.current = null;
        levelContainers.clear();
        loadedLevels.clear();

      appRef.current?.destroy(true, { children: true });
      appRef.current = null;

      host.replaceChildren();
    };
  }, [levelTiles, manifest.levels, maxLevel.height, maxLevel.width, maxScale]);

  const visibleLevel = metrics?.activeLevel ?? manifest.levels[0];

  return (
    <main className="relative min-h-screen overflow-hidden bg-night text-ivory">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(143,186,255,0.2),_transparent_36%),linear-gradient(180deg,_rgba(7,15,28,0.18),_rgba(7,15,28,0.76))]" />

      <div
        ref={hostRef}
        className="relative h-screen w-full overflow-hidden bg-[linear-gradient(180deg,_#d7edf8_0%,_#edf7fb_26%,_#dbe2df_52%,_#73848f_100%)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3 sm:p-4">
          <div className="w-full max-w-4xl rounded-[28px] border border-white/10 bg-night/34 px-3 py-2 shadow-[0_12px_40px_rgba(4,10,20,0.18)] backdrop-blur-md sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ivory/38">PixiJS v8 panorama stage</p>
                <h1 className="mt-1 text-xs font-medium tracking-[0.04em] text-ivory/82 sm:text-sm">
                  Local Zillertal Arena artwork now pans and zooms on a GPU-backed canvas.
                </h1>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-emerald-300/14 bg-emerald-300/8 px-2.5 py-1.5 text-right text-[10px] text-emerald-100/62 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_10px_rgba(110,231,183,0.55)]" />
                <span>{loadedLevelCount}/{manifest.levels.length} levels ready</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
          <div className="mx-auto grid max-w-4xl gap-2.5 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[22px] border border-white/10 bg-night/38 p-3 shadow-[0_14px_44px_rgba(5,12,24,0.22)] backdrop-blur-md sm:p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-ivory/38">Renderer status</p>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-ivory/72 sm:text-[13px]">
                The panorama now lives in PixiJS with persistent level containers, so pinch, wheel, and drag interactions
                stay smooth while lower and higher resolutions blend based on scale.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="Level" value={`L${visibleLevel.localIndex}`} detail={`remote z${visibleLevel.remoteZoom}`} />
              <StatCard label="Resolution" value={`${visibleLevel.width}x${visibleLevel.height}`} detail="blended nearest level" />
              <StatCard label="Viewport" value={`${containerSize.width}x${containerSize.height}`} detail="live shell size" />
              <StatCard label="Zoom" value={metrics ? metrics.zoom.toFixed(2) : "--"} detail="pinch or wheel" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-white/9 bg-white/6 p-3 backdrop-blur-md">
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-ivory/34">{label}</p>
      <p className="mt-1.5 text-base font-medium text-ivory/86 sm:text-lg">{value}</p>
      <p className="mt-0.5 text-[11px] text-ivory/44">{detail}</p>
    </div>
  );
}

async function loadLevelIntoViewport(
  viewport: Viewport,
  levelContainers: Map<number, Container>,
  level: PanoramaLevel,
  tiles: TileDescriptor[],
) {
  await Assets.load(tiles.map((tile) => tile.src));

  const container = new Container();
  container.label = `panorama-level-${level.remoteZoom}`;
  container.alpha = 0;

  for (const tile of tiles) {
    const sprite = Sprite.from(tile.src);
    sprite.x = tile.left;
    sprite.y = tile.top;
    sprite.width = tile.width;
    sprite.height = tile.height;
    container.addChild(sprite);
  }

  viewport.addChild(container);
  levelContainers.set(level.remoteZoom, container);
}

function createTileDescriptors(manifest: PanoramaManifest, level: PanoramaLevel, maxLevel: PanoramaLevel) {
  const scale = maxLevel.width / level.width;
  const tiles: TileDescriptor[] = [];

  for (let y = 0; y < level.rows; y += 1) {
    for (let x = 0; x < level.columns; x += 1) {
      const tileWidth = Math.min(manifest.tileSize, level.width - x * manifest.tileSize);
      const tileHeight = Math.min(manifest.tileSize, level.height - y * manifest.tileSize);

      tiles.push({
        key: `${level.remoteZoom}-${x}-${y}`,
        src: buildTileUrl(level.remoteZoom, x, y),
        left: x * manifest.tileSize * scale,
        top: y * manifest.tileSize * scale,
        width: tileWidth * scale,
        height: tileHeight * scale,
      });
    }
  }

  return tiles;
}

function applyLevelBlend(
  levels: PanoramaLevel[],
  containers: Map<number, Container>,
  loadedLevels: Set<number>,
  projectedWidth: number,
) {
  const available = levels.filter((level) => loadedLevels.has(level.remoteZoom));

  if (available.length === 0) {
    return;
  }

  for (const level of levels) {
    const container = containers.get(level.remoteZoom);

    if (container) {
      container.alpha = 0;
      container.visible = false;
    }
  }

  if (available.length === 1) {
    const container = containers.get(available[0].remoteZoom);

    if (container) {
      container.alpha = 1;
      container.visible = true;
    }

    return;
  }

  for (let index = 0; index < available.length - 1; index += 1) {
    const lower = available[index];
    const upper = available[index + 1];
    const fadeStart = lower.width * 0.75;
    const fadeEnd = lower.width;

    if (projectedWidth <= fadeStart) {
      const lowerContainer = containers.get(lower.remoteZoom);

      if (lowerContainer) {
        lowerContainer.alpha = 1;
        lowerContainer.visible = true;
      }

      return;
    }

    if (projectedWidth <= fadeEnd) {
      const mix = clamp((projectedWidth - fadeStart) / Math.max(fadeEnd - fadeStart, 1), 0, 1);
      const lowerContainer = containers.get(lower.remoteZoom);
      const upperContainer = containers.get(upper.remoteZoom);

      if (lowerContainer) {
        lowerContainer.alpha = 1 - mix;
        lowerContainer.visible = lowerContainer.alpha > 0;
      }

      if (upperContainer) {
        upperContainer.alpha = mix;
        upperContainer.visible = upperContainer.alpha > 0;
      }

      return;
    }
  }

  const last = containers.get(available[available.length - 1].remoteZoom);

  if (last) {
    last.alpha = 1;
    last.visible = true;
  }
}

function pickLoadedBlendLevel(levels: PanoramaLevel[], loadedLevels: Set<number>, projectedWidth: number) {
  const available = levels.filter((level) => loadedLevels.has(level.remoteZoom));

  if (available.length === 0) {
    return null;
  }

  let winner = available[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const level of available) {
    const distance = Math.abs(level.width - projectedWidth);

    if (distance < smallestDistance) {
      winner = level;
      smallestDistance = distance;
    }
  }

  return winner;
}

function computeMinScale(screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number) {
  return Math.min(screenWidth / worldWidth, screenHeight / worldHeight) * 0.92;
}

function buildTileUrl(remoteZoom: number, x: number, y: number) {
  return `/resorts/zillertal-arena/panorama/${remoteZoom}/pano_${x}_${y}.jpg`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
