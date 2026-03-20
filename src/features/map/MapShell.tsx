"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Sprite } from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { PanoramaLevel, PanoramaManifest } from "./types";
import { loadArenaOverlayData } from "@/lib/resorts/arena/adapter";
import { drawPisteOverlay } from "./overlays/drawPisteOverlay";
import { drawLiftOverlay } from "./overlays/drawLiftOverlay";
import { drawLabelOverlay } from "./overlays/drawLabelOverlay";
import { drawLiftMarkerOverlay } from "./overlays/drawLiftMarkerOverlay";

// Minimum viewport scale at which each tier becomes visible.
// Scale 0.09 ≈ fully zoomed out on a 390px screen; ~2 ≈ fully zoomed in.
const LABEL_TIER_SCALES = [0, 0.25, 0.50, 0.85] as const;

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

export function MapShell({ manifest }: MapShellProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const levelContainersRef = useRef<Map<number, Container>>(new Map());
  const loadedLevelsRef = useRef<Set<number>>(new Set());
  const hasInteractedRef = useRef(false);
  const pisteOverlayRef = useRef<Container | null>(null);
  const liftOverlayRef = useRef<Container | null>(null);
  const liftMarkerOverlayRef = useRef<Container | null>(null);

  const [liftVisible, setLiftVisible] = useState(true);
  const [pisteVisible, setPisteVisible] = useState(true);

  const [loadedLevelCount, setLoadedLevelCount] = useState(0);

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

    const syncLevelBlend = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const projectedWidth = maxLevel.width * viewport.scale.x;
      applyLevelBlend(manifest.levels, levelContainersRef.current, loadedLevelsRef.current, projectedWidth);
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

    let wheelPanHandler: ((e: WheelEvent) => void) | null = null;

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

      viewport.drag().pinch().wheel({ smooth: 6, trackpadPinch: true, wheelZoom: false }).decelerate({ friction: 0.95, minSpeed: 0.01 });
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

      wheelPanHandler = (e: WheelEvent) => {
        if (e.ctrlKey) {
          // ctrlKey = trackpad pinch — pixi-viewport's wheel plugin handles this via trackpadPinch
          return;
        }
        e.preventDefault();
        const vp = viewportRef.current;
        if (!vp) return;

        vp.x -= e.deltaX;
        vp.y -= e.deltaY;

        // Enforce world bounds manually (mirrors clamp plugin's "all" + "center" settings).
        // Direct x/y mutation bypasses pixi-viewport's plugin pipeline, so we clamp here.
        const scaledW = vp.worldWidth * vp.scale.x;
        const scaledH = vp.worldHeight * vp.scale.y;
        if (scaledW >= vp.screenWidth) {
          vp.x = Math.min(0, Math.max(vp.screenWidth - scaledW, vp.x));
        } else {
          vp.x = (vp.screenWidth - scaledW) / 2;
        }
        if (scaledH >= vp.screenHeight) {
          vp.y = Math.min(0, Math.max(vp.screenHeight - scaledH, vp.y));
        } else {
          vp.y = (vp.screenHeight - scaledH) / 2;
        }

        vp.emit("moved", { type: "wheel-pan", viewport: vp });
        hasInteractedRef.current = true;
      };

      app.canvas.addEventListener("wheel", wheelPanHandler, { passive: false });

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

      const overlayData = await loadArenaOverlayData();

      if (cancelled) {
        return;
      }

      const pisteContainer = new Container();
      pisteContainer.label = "overlay-pistes";
      drawPisteOverlay(pisteContainer, overlayData.pistes);
      viewport.addChild(pisteContainer);
      pisteOverlayRef.current = pisteContainer;

      const liftContainer = new Container();
      liftContainer.label = "overlay-lifts";
      drawLiftOverlay(liftContainer, overlayData.lifts);
      viewport.addChild(liftContainer);
      liftOverlayRef.current = liftContainer;

      const liftMarkerContainer = new Container();
      liftMarkerContainer.label = "overlay-lift-markers";
      drawLiftMarkerOverlay(liftMarkerContainer, overlayData.lifts);
      viewport.addChild(liftMarkerContainer);
      liftMarkerOverlayRef.current = liftMarkerContainer;

      const labelContainer = new Container();
      labelContainer.label = "overlay-labels";
      const labelTiers = drawLabelOverlay(labelContainer, overlayData.labels);
      viewport.addChild(labelContainer);

      const syncLabelTiers = () => {
        const scale = viewport.scale.x;
        labelTiers[0].visible = true;
        labelTiers[1].visible = scale >= LABEL_TIER_SCALES[1];
        labelTiers[2].visible = scale >= LABEL_TIER_SCALES[2];
        labelTiers[3].visible = scale >= LABEL_TIER_SCALES[3];
      };

      viewport.on("moved", syncLabelTiers);
      syncLabelTiers();
    };

    initialize().catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
    });

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      syncViewportBounds(false);
    });

    resizeObserverRef.current.observe(host);

    return () => {
      cancelled = true;

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (wheelPanHandler && appRef.current?.canvas) {
        appRef.current.canvas.removeEventListener("wheel", wheelPanHandler);
      }

      viewportRef.current?.destroy({ children: true });
      viewportRef.current = null;
      levelContainers.clear();
      loadedLevels.clear();

      appRef.current?.destroy(true, { children: true });
      appRef.current = null;

      host.replaceChildren();
    };
  }, [levelTiles, manifest.levels, maxLevel.height, maxLevel.width, maxScale]);

  const isLoading = loadedLevelCount < manifest.levels.length;

  const toggleLifts = () => {
    const next = !liftVisible;
    setLiftVisible(next);
    if (liftOverlayRef.current) liftOverlayRef.current.visible = next;
    if (liftMarkerOverlayRef.current) liftMarkerOverlayRef.current.visible = next;
  };

  const togglePistes = () => {
    const next = !pisteVisible;
    setPisteVisible(next);
    if (pisteOverlayRef.current) pisteOverlayRef.current.visible = next;
  };

  return (
    <main className="relative h-screen w-full overflow-hidden bg-night text-ivory">
      {/* Map canvas */}
      <div
        ref={hostRef}
        className="absolute inset-0 bg-[linear-gradient(180deg,_#d7edf8_0%,_#edf7fb_26%,_#dbe2df_52%,_#73848f_100%)]"
      />

      {/* Loading bar — top edge */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] transition-opacity duration-700"
        style={{ opacity: isLoading ? 1 : 0 }}
      >
        <div
          className="h-full bg-[#a8cfe0] transition-[width] duration-500"
          style={{ width: `${(loadedLevelCount / manifest.levels.length) * 100}%` }}
        />
      </div>

      {/* Top-left: menu trigger */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3.5">
        <button
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] bg-[#07111f]/65 shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 active:bg-[#07111f]/80"
          aria-label="Open menu"
        >
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
            <rect width="15" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
            <rect y="4.75" width="11" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
            <rect y="9.5" width="15" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
          </svg>
        </button>
      </div>

      {/* Bottom: primary map controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-8">
        <div className="pointer-events-auto flex gap-1 rounded-[22px] border border-white/[0.09] bg-[#07111f]/68 p-1.5 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
          <MapControlButton icon={<LiftIcon />} label="Lifts" active={liftVisible} onClick={toggleLifts} />
          <MapControlButton icon={<SlopeIcon />} label="Slopes" active={pisteVisible} onClick={togglePistes} />
        </div>
      </div>
    </main>
  );
}

function MapControlButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-[16px] px-5 py-2.5 transition-[transform,background-color,color] active:scale-[0.96] ${active ? "bg-white/[0.11] text-ivory" : "text-ivory/40 hover:bg-white/[0.07] hover:text-ivory/70"}`}
    >
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">{label}</span>
    </button>
  );
}

function LiftIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
      {/* cable */}
      <line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* left pole */}
      <line x1="4" y1="5" x2="4" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45" />
      {/* right pole */}
      <line x1="16" y1="5" x2="16" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45" />
      {/* hanger */}
      <line x1="10" y1="2" x2="10" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* gondola body */}
      <rect x="6.25" y="5" width="7.5" height="6.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SlopeIcon() {
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
      {/* mountain */}
      <path d="M2 16 L10 3 L18 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
      {/* piste line */}
      <path d="M10 3 L14.5 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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


function computeMinScale(screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number) {
  return Math.min(screenWidth / worldWidth, screenHeight / worldHeight) * 0.92;
}

function buildTileUrl(remoteZoom: number, x: number, y: number) {
  return `/resorts/zillertal-arena/panorama/${remoteZoom}/pano_${x}_${y}.jpg`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
