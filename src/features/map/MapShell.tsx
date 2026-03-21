"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { PanoramaLevel, PanoramaManifest } from "./types";
import { loadArenaOverlayData } from "@/lib/resorts/arena/adapter";
import { drawPisteOverlay } from "./overlays/drawPisteOverlay";
import { drawLiftOverlay } from "./overlays/drawLiftOverlay";
import { drawLabelOverlay } from "./overlays/drawLabelOverlay";
import { drawLiftMarkerOverlay } from "./overlays/drawLiftMarkerOverlay";
import { drawPisteMarkerOverlay } from "./overlays/drawPisteMarkerOverlay";
import { drawPisteHighlight, drawLiftHighlight, drawBadgeHighlight } from "./overlays/drawHighlightOverlay";
import { hitTestOverlays } from "./hitTest";
import { InfoSheet } from "./InfoSheet";
import type { ResortOverlayData, Piste, Lift } from "@/lib/domain/types";

// Minimum viewport scale at which each tier becomes visible.
// Scale 0.09 ≈ fully zoomed out on a 390px screen; ~2 ≈ fully zoomed in.
const LABEL_TIER_SCALES = [0, 0.25, 0.50, 0.85] as const;

type MapShellProps = {
  manifest: PanoramaManifest;
};

type DebugStats = {
  scale: number;
  activeLevel: number;
  blendPct: number;
  worldCenterX: number;
  worldCenterY: number;
  loadedCount: number;
  totalCount: number;
};

type TileDescriptor = {
  key: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
};

export function MapShell({ manifest }: MapShellProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const levelContainersRef = useRef<Map<number, Container>>(new Map());
  const loadedLevelsRef = useRef<Set<number>>(new Set());
  const hasInteractedRef = useRef(false);
  const overlayDataRef = useRef<ResortOverlayData | null>(null);
  const pisteOverlayRef = useRef<Container | null>(null);
  const liftOverlayRef = useRef<Container | null>(null);
  const liftMarkerOverlayRef = useRef<Container | null>(null);
  const pisteMarkerRef = useRef<Container | null>(null);
  const pisteHighlightRef = useRef<Graphics | null>(null);
  const liftHighlightRef = useRef<Graphics | null>(null);
  const badgeHighlightRef = useRef<Graphics | null>(null);

  const [liftVisible, setLiftVisible] = useState(true);
  const liftVisibleRef = useRef(true);
  const [pisteVisible, setPisteVisible] = useState(true);
  const pisteVisibleRef = useRef(true);
  const [selectedItem, setSelectedItem] = useState<Piste | Lift | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const debugModeRef = useRef(false);
  const debugLayerRef = useRef<Graphics | null>(null);
  const redrawDebugRef = useRef<(() => void) | null>(null);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const minScaleRef = useRef(0.05);

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
      minScaleRef.current = minScale;

      viewport.resize(host.clientWidth, host.clientHeight, maxLevel.width, maxLevel.height);
      viewport.clampZoom({ minScale, maxScale });
      viewport.clamp({ direction: "all", underflow: "center" });

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
      app.canvas.className = "h-full w-full touch-none select-none";
      appRef.current = app;

      const viewport = new Viewport({
        screenWidth: host.clientWidth,
        screenHeight: host.clientHeight,
        worldWidth: maxLevel.width,
        worldHeight: maxLevel.height,
        events: app.renderer.events,
      });

      viewport.drag().pinch().wheel({ smooth: 6, trackpadPinch: true }).decelerate({ friction: 0.95, minSpeed: 0.01 });
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
        // ctrlKey = trackpad pinch — pixi-viewport's wheel plugin handles this via trackpadPinch
        if (e.ctrlKey) return;

        // Only intercept events with a significant horizontal component — a reliable indicator of
        // trackpad 2D scroll. Pure vertical events (mouse wheel or trackpad vertical-only) fall
        // through to pixi-viewport's zoom handler, which is the correct desktop behavior.
        // Note: deltaMode is always 0 on Wayland/libinput regardless of input device, so it
        // cannot be used to distinguish mouse wheel from trackpad.
        if (Math.abs(e.deltaX) < 2) return;

        // Trackpad 2D scroll — pan the map. Intercept before pixi-viewport zooms.
        e.stopImmediatePropagation();
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

        vp.emit("moved", { type: "wheel", viewport: vp });
        hasInteractedRef.current = true;
      };

      app.canvas.addEventListener("wheel", wheelPanHandler, { capture: true, passive: false });

      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      syncViewportBounds(true);

      // Load and draw overlays first so they appear before any tile images.
      // tileLayer sits below all overlay containers in the display list so tiles
      // can never render on top of overlays regardless of when they finish loading.
      const tileLayer = new Container();
      tileLayer.label = "tile-layer";
      viewport.addChild(tileLayer);

      const overlayData = await loadArenaOverlayData();

      if (cancelled) {
        return;
      }

      overlayDataRef.current = overlayData;

      const pisteContainer = new Container();
      pisteContainer.label = "overlay-pistes";
      drawPisteOverlay(pisteContainer, overlayData.pistes);
      viewport.addChild(pisteContainer);
      pisteOverlayRef.current = pisteContainer;

      // Piste highlight — below lifts so lift lines render on top
      const pisteHighlight = new Graphics();
      pisteHighlight.label = "overlay-piste-highlight";
      viewport.addChild(pisteHighlight);
      pisteHighlightRef.current = pisteHighlight;

      const liftContainer = new Container();
      liftContainer.label = "overlay-lifts";
      drawLiftOverlay(liftContainer, overlayData.lifts);
      viewport.addChild(liftContainer);
      liftOverlayRef.current = liftContainer;

      // Lift highlight — above lifts so gold color overwrites the green inner
      const liftHighlight = new Graphics();
      liftHighlight.label = "overlay-lift-highlight";
      viewport.addChild(liftHighlight);
      liftHighlightRef.current = liftHighlight;

      const liftMarkerContainer = new Container();
      liftMarkerContainer.label = "overlay-lift-markers";
      drawLiftMarkerOverlay(liftMarkerContainer, overlayData.lifts);
      viewport.addChild(liftMarkerContainer);
      liftMarkerOverlayRef.current = liftMarkerContainer;

      const pisteMarkerContainer = new Container();
      pisteMarkerContainer.label = "overlay-piste-markers";
      drawPisteMarkerOverlay(pisteMarkerContainer, overlayData.pistes);
      viewport.addChild(pisteMarkerContainer);
      pisteMarkerRef.current = pisteMarkerContainer;

      const badgeHighlight = new Graphics();
      badgeHighlight.label = "overlay-badge-highlight";
      viewport.addChild(badgeHighlight);
      badgeHighlightRef.current = badgeHighlight;

      const labelContainer = new Container();
      labelContainer.label = "overlay-labels";
      const labelTiers = drawLabelOverlay(labelContainer, overlayData.labels);
      viewport.addChild(labelContainer);

      // Debug layer — above all overlays, invisible unless debug mode is active
      const debugLayer = new Graphics();
      debugLayer.label = "debug-layer";
      debugLayer.visible = false;
      viewport.addChild(debugLayer);
      debugLayerRef.current = debugLayer;

      const redrawDebug = () => {
        const g = debugLayerRef.current;
        const vp = viewportRef.current;
        if (!g || !vp) return;
        g.clear();
        if (!debugModeRef.current) return;

        let activeZoom = -1, highestAlpha = -1;
        for (const [zoom, container] of levelContainersRef.current) {
          if (container.alpha > highestAlpha) {
            highestAlpha = container.alpha;
            activeZoom = zoom;
          }
        }
        if (activeZoom === -1) return;

        const level = manifest.levels.find(l => l.remoteZoom === activeZoom);
        if (!level) return;

        const scale = maxLevel.width / level.width;
        const tw = manifest.tileSize * scale;
        const th = manifest.tileSize * scale;

        for (let y = 0; y < level.rows; y++) {
          for (let x = 0; x < level.columns; x++) {
            g.rect(x * tw, y * th, tw, th);
            g.stroke({ width: 2 / vp.scale.x, color: 0xff00ff, alpha: 0.6 });
          }
        }

        const centerWorldX = -vp.x / vp.scale.x + vp.screenWidth / 2 / vp.scale.x;
        const centerWorldY = -vp.y / vp.scale.y + vp.screenHeight / 2 / vp.scale.y;

        setDebugStats({
          scale: vp.scale.x,
          activeLevel: activeZoom,
          blendPct: highestAlpha * 100,
          worldCenterX: Math.round(centerWorldX),
          worldCenterY: Math.round(centerWorldY),
          loadedCount: loadedLevelsRef.current.size,
          totalCount: manifest.levels.length,
        });
      };

      redrawDebugRef.current = redrawDebug;

      const firstLevel = manifest.levels[0];
      await loadLevelIntoViewport(
        tileLayer,
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

      await Promise.all(
        manifest.levels.slice(1).map(async (level) => {
          await loadLevelIntoViewport(tileLayer, levelContainersRef.current, level, levelTiles.get(level.remoteZoom) ?? []);
          if (cancelled) return;
          loadedLevelsRef.current.add(level.remoteZoom);
          setLoadedLevelCount(loadedLevelsRef.current.size);
          syncLevelBlend();
        }),
      );

      const syncLabelTiers = () => {
        const scale = viewport.scale.x;
        labelTiers[0].visible = true;
        labelTiers[1].visible = scale >= LABEL_TIER_SCALES[1];
        labelTiers[2].visible = scale >= LABEL_TIER_SCALES[2];
        labelTiers[3].visible = scale >= LABEL_TIER_SCALES[3];
      };

      viewport.on("moved", () => { syncLabelTiers(); redrawDebug(); });
      syncLabelTiers();

      viewport.on("clicked", ({ world }: { world: { x: number; y: number } }) => {
        const data = overlayDataRef.current;
        if (!data) return;
        const hit = hitTestOverlays(
          world.x, world.y,
          pisteVisibleRef.current ? data.pistes : [],
          liftVisibleRef.current ? data.lifts : [],
        );
        setSelectedItem(hit);
        console.log("clicked:", hit?.name ?? "none", hit);
      });
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
        appRef.current.canvas.removeEventListener("wheel", wheelPanHandler, { capture: true });
      }

      viewportRef.current?.destroy({ children: true });
      viewportRef.current = null;
      levelContainers.clear();
      loadedLevels.clear();

      appRef.current?.destroy(true, { children: true });
      appRef.current = null;

      pisteHighlightRef.current = null;
      liftHighlightRef.current = null;
      badgeHighlightRef.current = null;

      host.replaceChildren();
    };
  }, [levelTiles, manifest.levels, maxLevel.height, maxLevel.width, maxScale]);

  useEffect(() => {
    debugModeRef.current = debugMode;
    if (debugLayerRef.current) debugLayerRef.current.visible = debugMode;
    if (!debugMode) setDebugStats(null);
    redrawDebugRef.current?.();
  }, [debugMode]);

  useEffect(() => {
    const pg = pisteHighlightRef.current;
    const lg = liftHighlightRef.current;
    const bh = badgeHighlightRef.current;
    if (!pg || !lg) return;
    if (selectedItem && "difficulty" in selectedItem) {
      drawPisteHighlight(pg, selectedItem);
      drawLiftHighlight(lg, null);
    } else {
      drawPisteHighlight(pg, null);
      drawLiftHighlight(lg, selectedItem as Lift | null);
    }
    if (bh) drawBadgeHighlight(bh, selectedItem);
  }, [selectedItem]);

  const isLoading = loadedLevelCount < manifest.levels.length;

  const HIDDEN_ALPHA = 0.15;

  const toggleLifts = () => {
    const next = !liftVisible;
    setLiftVisible(next);
    liftVisibleRef.current = next;
    if (liftOverlayRef.current) liftOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
    if (liftMarkerOverlayRef.current) liftMarkerOverlayRef.current.visible = next;
  };

  const togglePistes = () => {
    const next = !pisteVisible;
    setPisteVisible(next);
    pisteVisibleRef.current = next;
    if (pisteOverlayRef.current) pisteOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
    if (pisteMarkerRef.current) pisteMarkerRef.current.visible = next;
  };

  const toggleDebug = () => setDebugMode(d => !d);

  const onZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const t = parseFloat(e.target.value);
    const logMin = Math.log(minScaleRef.current);
    const logMax = Math.log(maxScale);
    vp.scaled = Math.exp(logMin + t * (logMax - logMin));
    vp.emit("moved", { type: "wheel", viewport: vp });
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

      {/* Top-right: debug toggle */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 p-3.5">
        <button
          onClick={toggleDebug}
          className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 ${debugMode ? "bg-yellow-400/90 text-black" : "bg-[#07111f]/65 text-white/70"}`}
          aria-label="Toggle debug overlay"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="0.5" y="0.5" width="6" height="6" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9.5" y="0.5" width="6" height="6" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
            <rect x="0.5" y="9.5" width="6" height="6" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9.5" y="9.5" width="6" height="6" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
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

      <InfoSheet selectedItem={selectedItem} />

      {debugMode && debugStats && (
        <div className="absolute bottom-4 left-4 z-50 rounded bg-black/70 p-2 font-mono text-xs text-white space-y-1.5">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={(() => {
              const logMin = Math.log(minScaleRef.current);
              const logMax = Math.log(maxScale);
              return ((Math.log(debugStats.scale) - logMin) / (logMax - logMin)).toFixed(4);
            })()}
            onChange={onZoomSliderChange}
            className="w-full accent-yellow-400"
            aria-label="Zoom"
          />
          <div className="space-y-0.5 pointer-events-none">
            <div>scale: {debugStats.scale.toFixed(4)}</div>
            <div>level: z{debugStats.activeLevel} ({debugStats.blendPct.toFixed(0)}%)</div>
            <div>center: {debugStats.worldCenterX}, {debugStats.worldCenterY}</div>
            <div>loaded: {debugStats.loadedCount}/{debugStats.totalCount}</div>
          </div>
        </div>
      )}
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
    <svg width="22" height="20" viewBox="-14 -13 28 26" fill="none" aria-hidden="true">
      {/* Angled cable */}
      <line x1="-13" y1="-5" x2="13" y2="-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Grip clamp */}
      <rect x="-3" y="-11" width="6" height="3" rx="1" fill="currentColor" />
      {/* V hangers */}
      <line x1="-1.5" y1="-8" x2="-5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1.5" y1="-8" x2="5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Top deck */}
      <rect x="-8" y="-3" width="16" height="3" stroke="currentColor" strokeWidth="1.5" />
      {/* Cabin */}
      <rect x="-8" y="0" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {/* Left window */}
      <rect x="-7" y="2" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
      {/* Right window */}
      <rect x="2" y="2" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
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
  tileLayer: Container,
  levelContainers: Map<number, Container>,
  level: PanoramaLevel,
  tiles: TileDescriptor[],
) {
  await Assets.load(tiles.map((tile) => tile.src));

  const container = new Container();
  container.label = `panorama-level-${level.remoteZoom}`;
  container.alpha = 0;

  for (const tile of tiles) {
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
  }

  tileLayer.addChild(container);
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
        srcWidth: tileWidth,
        srcHeight: tileHeight,
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

      // Keep lower at full alpha so the background never bleeds through.
      // Upper fades in on top; once fully opaque it covers the lower entirely.
      if (lowerContainer) {
        lowerContainer.alpha = 1;
        lowerContainer.visible = true;
      }

      if (upperContainer) {
        upperContainer.alpha = mix;
        upperContainer.visible = mix > 0;
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
  return `/resorts/zillertal-arena/panorama/${remoteZoom}/pano_${x}_${y}.webp`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
