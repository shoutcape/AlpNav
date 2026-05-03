"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { createTileDescriptors } from "./tile-types";
import { TileScheduler } from "./tile-scheduler";
import { RESORTS, canActivateResort, resolveActiveResort } from "@/lib/resorts/catalog";
import { drawPisteHighlight, drawLiftHighlight, drawBadgeHighlight } from "./overlays/drawHighlightOverlay";
import { hitTestOverlays } from "./hitTest";
import { InfoSheet } from "./InfoSheet";
import { Drawer } from "./Drawer";
import type { ResortOverlayData, Piste, Lift, GastronomySpot, Webcam, InfrastructurePoi, SportFunPoi, PisteDifficulty } from "@/lib/domain/types";
import { applyFreshStatus, fetchFreshStatus } from "@/lib/resorts/status-refresh";
import { RefreshButton } from "./RefreshButton";
import { DEFAULT_PISTE_FILTER, DIFFICULTIES, LABEL_TIER_SCALES } from "./map-constants";
import { LegendPanel } from "./LegendPanel";
import { LayerControls } from "./LayerControls";
import { MapLoadErrorBanner, MapLoadingBar } from "./MapLoadingOverlays";
import { MapDebugPanel } from "./MapDebugPanel";
import { GpsLocationButton } from "./GpsLocationButton";
import { applyLevelBlend, clamp, computeMinScale, getDominantLevel } from "./map-viewport";
import type { AnchorPoint, DebugAnchorPoint, DebugStats, GpsPosition, GpsStatus, SelectedMapItem } from "./map-shell-types";
import { findNearestAnchor, resolveGpsAnchorMatch } from "./gps-utils";
import { applyLiftVisibility, applyPisteDifficultyVisibility, applyPisteVisibility, applyPoiLayerVisibility, createMapLayers, redrawStatusLayers } from "./map-layers";
import type { MapLayerRefs } from "./map-layers";

type MapShellProps = {
  initialAreaId: string;
};

export function MapShell({ initialAreaId }: MapShellProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const loadRequestIdRef = useRef(0);
  const levelContainersRef = useRef<Map<number, Container>>(new Map());
  const loadedLevelsRef = useRef<Set<number>>(new Set());
  const hasInteractedRef = useRef(false);
  const schedulerRef = useRef<TileScheduler | null>(null);
  const overlayDataRef = useRef<ResortOverlayData | null>(null);
  const pisteOverlayRef = useRef<Container | null>(null);
  const liftOverlayRef = useRef<Container | null>(null);
  const liftMarkerOverlayRef = useRef<Container | null>(null);
  const pisteMarkerRef = useRef<Container | null>(null);
  const pisteHighlightRef = useRef<Graphics | null>(null);
  const liftHighlightRef = useRef<Graphics | null>(null);
  const badgeHighlightRef = useRef<Graphics | null>(null);


  const [selectedAreaId, setSelectedAreaId] = useState(() => resolveActiveResort(initialAreaId).id);
  const activeArea = useMemo(() => resolveActiveResort(selectedAreaId), [selectedAreaId]);
  const manifest = activeArea.manifest;

  const [liftVisible, setLiftVisible] = useState(true);
  const liftVisibleRef = useRef(true);
  const [pisteVisible, setPisteVisible] = useState(true);
  const pisteVisibleRef = useRef(true);
  const [pisteFilter, setPisteFilter] = useState<Record<PisteDifficulty, boolean>>(DEFAULT_PISTE_FILTER);
  const pisteFilterRef = useRef<Record<PisteDifficulty, boolean>>(DEFAULT_PISTE_FILTER);
  const pisteLinesByDiffRef = useRef<Record<PisteDifficulty, Container> | null>(null);
  const pisteMarkersByDiffRef = useRef<Record<PisteDifficulty, Container> | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const controlsExpandedRef = useRef(false);
  const [controlsDismissing, setControlsDismissing] = useState(false);
  const gastronomyOverlayRef = useRef<Container | null>(null);
  const [gastronomyVisible, setGastronomyVisible] = useState(true);
  const gastronomyVisibleRef = useRef(true);
  const webcamOverlayRef = useRef<Container | null>(null);
  const [webcamVisible, setWebcamVisible] = useState(true);
  const webcamVisibleRef = useRef(true);
  const infrastructureOverlayRef = useRef<Container | null>(null);
  const [infrastructureVisible, setInfrastructureVisible] = useState(true);
  const infrastructureVisibleRef = useRef(true);
  const sportFunOverlayRef = useRef<Container | null>(null);
  const [sportFunVisible, setSportFunVisible] = useState(true);
  const sportFunVisibleRef = useRef(true);

  const [selectedItem, setSelectedItem] = useState<SelectedMapItem | null>(null);
  const [debugMode, setDebugMode] = useState<false | "normal">(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("alpnav_debug_mode");
    if (saved === "normal") return saved;
    return false;
  });
  const debugModeRef = useRef<false | "normal">(false);
  const debugLayerRef = useRef<Graphics | null>(null);
  const redrawDebugRef = useRef<(() => void) | null>(null);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const minScaleRef = useRef(0.05);

  const [gpsActive, setGpsActive] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsMatch, setGpsMatch] = useState<AnchorPoint | null>(null);
  const [gpsPos, setGpsPos] = useState<GpsPosition | null>(null);
  const gpsAnchorsRef = useRef<AnchorPoint[]>([]);
  const gpsDotRef = useRef<Graphics | null>(null);
  const gpsWatchRef = useRef<number | null>(null);

  // Debug: anchor point testing
  const [debugAnchors, setDebugAnchors] = useState<DebugAnchorPoint[]>([]);
  const [debugSelectedAnchor, setDebugSelectedAnchor] = useState<string>("");
  const debugDotRef = useRef<Graphics | null>(null);

  // Debug panel drag
  const [debugPanelPos, setDebugPanelPos] = useState({ x: 16, y: -1 }); // x from left, y: -1 means "bottom-anchored"
  const debugDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const debugPanelRef = useRef<HTMLDivElement | null>(null);

  const [loadedLevelCount, setLoadedLevelCount] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getMapLayerRefs = (): MapLayerRefs => ({
    pisteOverlay: pisteOverlayRef.current,
    liftOverlay: liftOverlayRef.current,
    liftMarkerOverlay: liftMarkerOverlayRef.current,
    pisteMarkerOverlay: pisteMarkerRef.current,
    pisteHighlight: pisteHighlightRef.current,
    liftHighlight: liftHighlightRef.current,
    badgeHighlight: badgeHighlightRef.current,
    gastronomyOverlay: gastronomyOverlayRef.current,
    webcamOverlay: webcamOverlayRef.current,
    infrastructureOverlay: infrastructureOverlayRef.current,
    sportFunOverlay: sportFunOverlayRef.current,
    gpsDot: gpsDotRef.current,
    debugDot: debugDotRef.current,
    debugLayer: debugLayerRef.current,
    pisteLinesByDiff: pisteLinesByDiffRef.current,
    pisteMarkersByDiff: pisteMarkersByDiffRef.current,
  });

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
    const savedAreaId = localStorage.getItem("alpnav_active_area");
    let targetAreaId = resolveActiveResort(initialAreaId).id;

    if (savedAreaId && canActivateResort(savedAreaId)) {
      targetAreaId = savedAreaId;
    }

    setSelectedAreaId((currentAreaId) => {
      return currentAreaId === targetAreaId ? currentAreaId : targetAreaId;
    });
  }, [initialAreaId]);

  useEffect(() => {
    setSelectedItem(null);
    setDebugStats(null);
    setLegendOpen(false);
    setFilterPanelOpen(false);
    setLoadedLevelCount(0);
    setLiftVisible(true);
    liftVisibleRef.current = true;
    setPisteVisible(true);
    pisteVisibleRef.current = true;
    setPisteFilter(DEFAULT_PISTE_FILTER);
    pisteFilterRef.current = DEFAULT_PISTE_FILTER;
    setGastronomyVisible(true);
    gastronomyVisibleRef.current = true;
    setWebcamVisible(true);
    webcamVisibleRef.current = true;
    setInfrastructureVisible(true);
    infrastructureVisibleRef.current = true;
    setSportFunVisible(true);
    sportFunVisibleRef.current = true;
    hasInteractedRef.current = false;
    overlayDataRef.current = null;
    setLoadError(null);
  }, [activeArea.id]);

  useEffect(() => {
    const host = hostRef.current;
    const levelContainers = new Map<number, Container>();
    const loadedLevels = new Set<number>();
    const requestId = ++loadRequestIdRef.current;

    if (!host) {
      return;
    }

    levelContainersRef.current = levelContainers;
    loadedLevelsRef.current = loadedLevels;

    let cancelled = false;

    const syncLevelBlend = () => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const projectedWidth = maxLevel.width * viewport.scale.x;
      applyLevelBlend(manifest.levels, levelContainers, loadedLevels, projectedWidth);
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
    const suppressGesture = (e: Event) => e.preventDefault();

    const initialize = async () => {
      // Start overlay data fetch immediately — it runs in parallel with pixi
      // GPU initialization below, shaving ~200-500ms off the critical path.
      const overlayDataPromise = activeArea.loadOverlayData();

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
        passiveWheel: false,
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
      viewport.on("moved", () => {
        syncLevelBlend();
        schedulerRef.current?.scheduleUpdate(viewport);
      });

      wheelPanHandler = (e: WheelEvent) => {
        // ctrlKey = trackpad pinch — pixi-viewport's wheel plugin handles this via trackpadPinch.
        // preventDefault suppresses the browser's native page zoom on macOS.
        if (e.ctrlKey) {
          e.preventDefault();
          return;
        }

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
      // Suppress Safari's proprietary pinch-zoom gesture on the canvas.
      app.canvas.addEventListener("gesturestart", suppressGesture);
      app.canvas.addEventListener("gesturechange", suppressGesture);

      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      syncViewportBounds(true);

      // Load and draw overlays first so they appear before any tile images.
      // tileLayer sits below all overlay containers in the display list so tiles
      // can never render on top of overlays regardless of when they finish loading.
      const tileLayer = new Container();
      tileLayer.label = "tile-layer";
      viewport.addChild(tileLayer);

      if (loadRequestIdRef.current === requestId) {
        setLoadError(null);
      }

      const overlayData = await overlayDataPromise;

      if (cancelled) {
        return;
      }

      try {
        const fresh = await fetchFreshStatus(activeArea.id);
        applyFreshStatus(overlayData.lifts, overlayData.pistes, fresh);
      } catch {
        // Silent fallback — static data is used; user can tap refresh manually
      }

      overlayDataRef.current = overlayData;

      const { refs: layerRefs, labelTiers } = createMapLayers({
        viewport,
        overlayData,
        visualScale: activeArea.visualScale,
      });
      pisteOverlayRef.current = layerRefs.pisteOverlay;
      liftOverlayRef.current = layerRefs.liftOverlay;
      liftMarkerOverlayRef.current = layerRefs.liftMarkerOverlay;
      pisteMarkerRef.current = layerRefs.pisteMarkerOverlay;
      pisteHighlightRef.current = layerRefs.pisteHighlight;
      liftHighlightRef.current = layerRefs.liftHighlight;
      badgeHighlightRef.current = layerRefs.badgeHighlight;
      gastronomyOverlayRef.current = layerRefs.gastronomyOverlay;
      webcamOverlayRef.current = layerRefs.webcamOverlay;
      infrastructureOverlayRef.current = layerRefs.infrastructureOverlay;
      sportFunOverlayRef.current = layerRefs.sportFunOverlay;
      gpsDotRef.current = layerRefs.gpsDot;
      debugDotRef.current = layerRefs.debugDot;
      debugLayerRef.current = layerRefs.debugLayer;
      pisteLinesByDiffRef.current = layerRefs.pisteLinesByDiff;
      pisteMarkersByDiffRef.current = layerRefs.pisteMarkersByDiff;

      const redrawDebug = () => {
        const g = debugLayerRef.current;
        const vp = viewportRef.current;
        if (!g || !vp) return;
        g.clear();
        if (!debugModeRef.current) return;

        const dominant = getDominantLevel(manifest.levels, levelContainers);
        if (!dominant) return;

        const { level, alpha } = dominant;

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
          activeLevel: level.remoteZoom,
          blendPct: alpha * 100,
          worldCenterX: Math.round(centerWorldX),
          worldCenterY: Math.round(centerWorldY),
          loadedCount: loadedLevels.size,
          totalCount: manifest.levels.length,
        });
      };

      redrawDebugRef.current = redrawDebug;

      // Load base level immediately — only 4 tiles, always needed as fallback
      const firstLevel = manifest.levels[0];
      const firstTiles = levelTiles.get(firstLevel.remoteZoom) ?? [];
      await Assets.load(firstTiles.map((tile) => tile.src));

      if (cancelled) return;

      const baseContainer = new Container();
      baseContainer.label = `panorama-level-${firstLevel.remoteZoom}`;
      baseContainer.alpha = 0;
      for (const tile of firstTiles) {
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
        baseContainer.addChild(sprite);
      }
      tileLayer.addChild(baseContainer);
      levelContainers.set(firstLevel.remoteZoom, baseContainer);
      loadedLevels.add(firstLevel.remoteZoom);
      setLoadedLevelCount(1);
      syncLevelBlend();

      // Initialize viewport-aware tile scheduler for remaining zoom levels
      const scheduler = new TileScheduler({
        manifest,
        maxLevel,
        levels: manifest.levels,
        levelTiles,
        tileLayer,
        levelContainers,
        loadedLevels,
        baseZoom: firstLevel.remoteZoom,
        onLevelReady: (zoom) => {
          loadedLevels.add(zoom);
          setLoadedLevelCount(loadedLevels.size);
          syncLevelBlend();
        },
      });
      schedulerRef.current = scheduler;
      scheduler.scheduleUpdate(viewport);

      const syncLabelTiers = () => {
        const scale = viewport.scale.x;
        const labelTierScales = activeArea.labelTierScales ?? LABEL_TIER_SCALES;
        labelTiers[0].visible = true;
        labelTiers[1].visible = scale >= labelTierScales[1];
        labelTiers[2].visible = scale >= labelTierScales[2];
        labelTiers[3].visible = scale >= labelTierScales[3];
      };

      viewport.on("moved", () => { syncLabelTiers(); redrawDebug(); });
      syncLabelTiers();

      viewport.on("clicked", ({ world }: { world: { x: number; y: number } }) => {
        if (controlsExpandedRef.current) {
          controlsExpandedRef.current = false;
          setControlsExpanded(false);
          setControlsDismissing(true);
          setTimeout(() => setControlsDismissing(false), 75);
          setFilterPanelOpen(false);
          return;
        }
        setFilterPanelOpen(false);
        setLegendOpen(false);

        const data = overlayDataRef.current;
        if (!data) return;
        const activePistes = pisteVisibleRef.current
          ? data.pistes.filter(p => pisteFilterRef.current[p.difficulty])
          : [];
        const activeGastronomy = gastronomyVisibleRef.current ? data.gastronomy : [];
        const activeWebcams = webcamVisibleRef.current ? data.webcams : [];
        const activeInfrastructure = infrastructureVisibleRef.current ? data.infrastructure : [];
        const activeSportFun = sportFunVisibleRef.current ? data.sportFun : [];
        const hit = hitTestOverlays(
          world.x, world.y,
          activePistes,
          liftVisibleRef.current ? data.lifts : [],
          activeGastronomy,
          activeWebcams,
          activeInfrastructure,
          activeSportFun,
          20, // default threshold
          activeArea.visualScale
        );
        setSelectedItem(hit);
      });
    };

    initialize().catch((error) => {
      if (cancelled || loadRequestIdRef.current !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      console.error(message);
      setLoadError(message);
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

      schedulerRef.current?.dispose();
      schedulerRef.current = null;

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (wheelPanHandler && appRef.current?.canvas) {
        appRef.current.canvas.removeEventListener("wheel", wheelPanHandler, { capture: true });
        appRef.current.canvas.removeEventListener("gesturestart", suppressGesture);
        appRef.current.canvas.removeEventListener("gesturechange", suppressGesture);
      }

      viewportRef.current?.destroy({ children: true });
      viewportRef.current = null;

      if (levelContainersRef.current === levelContainers) {
        levelContainersRef.current = new Map();
      }

      if (loadedLevelsRef.current === loadedLevels) {
        loadedLevelsRef.current = new Set();
      }

      levelContainers.clear();
      loadedLevels.clear();

      appRef.current?.destroy(true, { children: true });
      appRef.current = null;

      overlayDataRef.current = null;
      pisteOverlayRef.current = null;
      liftOverlayRef.current = null;
      liftMarkerOverlayRef.current = null;
      pisteMarkerRef.current = null;
      pisteHighlightRef.current = null;
      liftHighlightRef.current = null;
      badgeHighlightRef.current = null;
      gastronomyOverlayRef.current = null;
      webcamOverlayRef.current = null;
      infrastructureOverlayRef.current = null;
      sportFunOverlayRef.current = null;
      pisteLinesByDiffRef.current = null;
      pisteMarkersByDiffRef.current = null;
      debugDotRef.current = null;
      debugLayerRef.current = null;
      gpsDotRef.current = null;

      host.replaceChildren();
    };
  }, [activeArea, levelTiles, manifest.levels, manifest.tileSize, maxLevel.height, maxLevel.width, maxScale]);

  useEffect(() => {
    debugModeRef.current = debugMode;
    if (debugMode) localStorage.setItem("alpnav_debug_mode", debugMode);
    else localStorage.removeItem("alpnav_debug_mode");
    if (debugLayerRef.current) debugLayerRef.current.visible = !!debugMode;
    if (!debugMode) setDebugStats(null);
    redrawDebugRef.current?.();
  }, [debugMode]);

  // Load anchor points for debug testing
  useEffect(() => {
    if (!debugMode) return;
    fetch(`/resorts/${activeArea.id}/overlays/anchor-points.json`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setDebugAnchors(Array.isArray(data) ? data : []))
      .catch(() => setDebugAnchors([]));
  }, [debugMode, activeArea.id]);

  // Draw debug dot + center viewport when an anchor is selected
  useEffect(() => {
    const dot = debugDotRef.current;
    if (!dot) return;
    dot.clear();

    if (!debugSelectedAnchor) return;
    const anchor = debugAnchors.find((a) => a.id === debugSelectedAnchor);
    if (!anchor) return;

    const { x, y } = anchor.panorama;
    const s = activeArea.visualScale ?? 1;

    // Snap radius indicator (outer ring)
    const radiusPx = 60 * s;
    dot.circle(x, y, radiusPx);
    dot.fill({ color: 0x3b82f6, alpha: 0.1 });
    dot.circle(x, y, radiusPx);
    dot.stroke({ color: 0x3b82f6, width: 1.5 * s, alpha: 0.4 });

    // Center dot
    dot.circle(x, y, 10 * s);
    dot.fill({ color: 0x3b82f6, alpha: 0.85 });
    dot.circle(x, y, 10 * s);
    dot.stroke({ color: 0xffffff, width: 2.5 * s });

    if (viewportRef.current) {
      viewportRef.current.moveCenter(x, y);
    }
  }, [debugSelectedAnchor, debugAnchors, activeArea.visualScale]);

  // Load anchors for GPS snapping
  useEffect(() => {
    fetch(`/resorts/${activeArea.id}/overlays/anchor-points.json`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        gpsAnchorsRef.current = Array.isArray(data) ? data : [];
        console.debug("[AlpNav GPS] anchors loaded", {
          activeAreaId: activeArea.id,
          anchorCount: gpsAnchorsRef.current.length,
        });
      })
      .catch(() => {
        gpsAnchorsRef.current = [];
        console.debug("[AlpNav GPS] anchors failed to load", { activeAreaId: activeArea.id });
      });
  }, [activeArea.id]);

  // GPS watch position
  useEffect(() => {
    if (!gpsActive) {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      setGpsStatus("idle");
      setGpsMatch(null);
      setGpsPos(null);
      const dot = gpsDotRef.current;
      if (dot) dot.clear();
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }

    setGpsStatus("requesting");

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        const { latitude: lat, longitude: lng } = pos.coords;
        const match = resolveGpsAnchorMatch({ lat, lng }, gpsAnchorsRef.current, gpsMatch?.id ?? null);

        setGpsPos({ lat, lng, dist: match?.distance ?? null });
        setGpsMatch(match?.anchor ?? null);

        const dot = gpsDotRef.current;
        if (!dot) return;
        dot.clear();

        if (match) {
          const { x, y } = match.anchor.panorama;
          const s = activeArea.visualScale ?? 1;

          // Accuracy ring
          dot.circle(x, y, 50 * s);
          dot.fill({ color: 0x3b82f6, alpha: 0.1 });
          dot.circle(x, y, 50 * s);
          dot.stroke({ color: 0x3b82f6, width: 1.5 * s, alpha: 0.3 });

          // Center dot
          dot.circle(x, y, 10 * s);
          dot.fill({ color: 0x3b82f6, alpha: 0.9 });
          dot.circle(x, y, 10 * s);
          dot.stroke({ color: 0xffffff, width: 2.5 * s });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsStatus("unavailable");
        else setGpsStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [gpsActive, activeArea.visualScale]);

  useEffect(() => {
    const pg = pisteHighlightRef.current;
    const lg = liftHighlightRef.current;
    const bh = badgeHighlightRef.current;
    if (!pg || !lg) return;
    const isInfra    = selectedItem !== null && "category" in selectedItem;
    const isGastro   = selectedItem !== null && "position" in selectedItem && !("streamUrl" in selectedItem) && !("category" in selectedItem) && !("sportCategory" in selectedItem);
    const isWebcam   = selectedItem !== null && "streamUrl" in selectedItem;
    const isSportFun = !!selectedItem && "sportCategory" in selectedItem;
    if (!isInfra && !isGastro && !isWebcam && !isSportFun && selectedItem && "difficulty" in selectedItem) {
      drawPisteHighlight(pg, selectedItem, activeArea.visualScale);
      drawLiftHighlight(lg, null, activeArea.visualScale);
    } else {
      drawPisteHighlight(pg, null, activeArea.visualScale);
      drawLiftHighlight(lg, (isInfra || isGastro || isWebcam || isSportFun) ? null : selectedItem as Lift | null, activeArea.visualScale);
    }
    if (bh) drawBadgeHighlight(bh, isSportFun ? selectedItem as SportFunPoi : isWebcam ? selectedItem as Webcam : isInfra ? selectedItem as InfrastructurePoi : isGastro ? selectedItem as GastronomySpot : selectedItem as Piste | Lift | null, activeArea.visualScale);
  }, [selectedItem]);

  const toggleLifts = () => {
    const next = !liftVisible;
    setLiftVisible(next);
    liftVisibleRef.current = next;
    applyLiftVisibility(getMapLayerRefs(), next);
  };

  const toggleDifficultyFilter = (diff: PisteDifficulty) => {
    const next = { ...pisteFilterRef.current, [diff]: !pisteFilterRef.current[diff] };
    setPisteFilter(next);
    pisteFilterRef.current = next;

    const enabled = next[diff];
    applyPisteDifficultyVisibility(getMapLayerRefs(), diff, enabled);

    // If turning a filter on while the master switch is off, restore the parent
    // and explicitly dim all other off-filters (they were at alpha 1 with parent hiding them)
    if (enabled && !pisteVisibleRef.current) {
      setPisteVisible(true);
      pisteVisibleRef.current = true;
      applyPisteVisibility(getMapLayerRefs(), true, next);
    }
  };

  const toggleAllPistes = () => {
    const allOn = pisteVisibleRef.current && DIFFICULTIES.every(d => pisteFilterRef.current[d]);
    const turnOn = !allOn;
    setPisteVisible(turnOn);
    pisteVisibleRef.current = turnOn;

    const next = { easy: turnOn, medium: turnOn, difficult: turnOn, unknown: turnOn } as Record<PisteDifficulty, boolean>;
    setPisteFilter(next);
    pisteFilterRef.current = next;
    applyPisteVisibility(getMapLayerRefs(), turnOn, next);
  };

  const toggleGastronomy = () => {
    const next = !gastronomyVisible;
    setGastronomyVisible(next);
    gastronomyVisibleRef.current = next;
    applyPoiLayerVisibility(gastronomyOverlayRef.current, next);
  };

  const toggleInfrastructure = () => {
    const next = !infrastructureVisible;
    setInfrastructureVisible(next);
    infrastructureVisibleRef.current = next;
    applyPoiLayerVisibility(infrastructureOverlayRef.current, next);
  };

  const toggleSportFun = () => {
    const next = !sportFunVisible;
    setSportFunVisible(next);
    sportFunVisibleRef.current = next;
    applyPoiLayerVisibility(sportFunOverlayRef.current, next);
  };

  const toggleWebcam = () => {
    const next = !webcamVisible;
    setWebcamVisible(next);
    webcamVisibleRef.current = next;
    applyPoiLayerVisibility(webcamOverlayRef.current, next);
  };

  const toggleDebug = () => setDebugMode((currentMode) => (currentMode === false ? "normal" : false));

  const centerViewportOnGpsAnchor = (anchor: AnchorPoint, source: string) => {
    const viewport = viewportRef.current;

    if (!viewport) {
      console.debug("[AlpNav GPS] recenter skipped: viewport unavailable", { source, anchorId: anchor.id });
      return false;
    }

    console.debug("[AlpNav GPS] recentering viewport", {
      source,
      anchorId: anchor.id,
      anchorName: anchor.name,
      panorama: anchor.panorama,
      viewportCenterBefore: {
        x: viewport.center.x,
        y: viewport.center.y,
      },
    });
    viewport.moveCenter(anchor.panorama.x, anchor.panorama.y);
    console.debug("[AlpNav GPS] viewport recentered", {
      source,
      viewportCenterAfter: {
        x: viewport.center.x,
        y: viewport.center.y,
      },
    });

    return true;
  };

  const requestCurrentGpsPosition = () => {
    if (!("geolocation" in navigator)) {
      console.debug("[AlpNav GPS] recenter unavailable: geolocation API missing");
      setGpsActive(true);
      setGpsStatus("unavailable");
      return;
    }

    console.debug("[AlpNav GPS] recenter requested", {
      activeAreaId: activeArea.id,
      anchorCount: gpsAnchorsRef.current.length,
      currentMatchId: gpsMatch?.id ?? null,
    });
    setGpsActive(true);
    setGpsStatus("requesting");

    if (gpsMatch && centerViewportOnGpsAnchor(gpsMatch, "button-current-match")) {
      console.debug("[AlpNav GPS] recentered using current match before fresh sensor response");
    }

    setGpsMatch(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus("active");
        const { latitude: lat, longitude: lng } = pos.coords;
        const match = findNearestAnchor({ lat, lng }, gpsAnchorsRef.current);
        console.debug("[AlpNav GPS] sensor position received", {
          lat,
          lng,
          accuracy: pos.coords.accuracy,
          activeAreaId: activeArea.id,
          anchorCount: gpsAnchorsRef.current.length,
          matchId: match?.anchor.id ?? null,
          matchName: match?.anchor.name ?? null,
          matchDistance: match?.distance ?? null,
          viewportReady: !!viewportRef.current,
        });

        setGpsPos({ lat, lng, dist: match?.distance ?? null });
        setGpsMatch(match?.anchor ?? null);

        if (match && viewportRef.current) {
          centerViewportOnGpsAnchor(match.anchor, "button-fresh-position");
        } else if (!match) {
          console.debug("[AlpNav GPS] recenter skipped: no anchor match");
        } else {
          console.debug("[AlpNav GPS] recenter skipped: viewport unavailable");
        }
      },
      (err) => {
        console.debug("[AlpNav GPS] recenter geolocation error", {
          code: err.code,
          message: err.message,
        });
        if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsStatus("unavailable");
        else setGpsStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleRefreshStatus = async () => {
    const data = overlayDataRef.current;
    if (!data) return;

    const fresh = await fetchFreshStatus(activeArea.id);
    applyFreshStatus(data.lifts, data.pistes, fresh);

    redrawStatusLayers({ refs: getMapLayerRefs(), overlayData: data, visualScale: activeArea.visualScale });

    // Update selected item if it has a status field
    if (selectedItem && "status" in selectedItem) {
      setSelectedItem({ ...selectedItem } as typeof selectedItem);
    }
  };

  const onZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const t = parseFloat(e.target.value);
    const logMin = Math.log(minScaleRef.current);
    const logMax = Math.log(maxScale);
    vp.scaled = Math.exp(logMin + t * (logMax - logMin));
    vp.emit("moved", { type: "wheel", viewport: vp });
  };

  const handleDebugPanelPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const panel = debugPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    debugDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDebugPanelPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = debugDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setDebugPanelPos({
      x: drag.startPosX + dx,
      y: drag.startPosY + dy,
    });
  };

  const handleDebugPanelPointerUp = () => {
    debugDragRef.current = null;
  };

  const handleSelectArea = (areaId: string) => {
    if (areaId === activeArea.id) {
      return;
    }

    if (canActivateResort(areaId)) {
      setSelectedAreaId(areaId);
      localStorage.setItem("alpnav_active_area", areaId);
    }
  };

  return (
    <main className="relative h-screen w-full overflow-hidden bg-night text-ivory select-none">
      {/* Map canvas */}
      <div
        ref={hostRef}
        className="absolute inset-0 bg-[linear-gradient(180deg,_#d7edf8_0%,_#edf7fb_26%,_#dbe2df_52%,_#73848f_100%)]"
      />

      <MapLoadingBar loadedLevelCount={loadedLevelCount} totalLevelCount={manifest.levels.length} />

      {/* Top-left: menu trigger */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3.5">
        <button
          onClick={() => setDrawerOpen(true)}
          className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 ${drawerOpen ? "bg-white/[0.15] text-ivory" : "bg-[#07111f]/65"}`}
          aria-label="Open menu"
        >
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden="true">
            <rect width="15" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
            <rect y="4.75" width="11" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
            <rect y="9.5" width="15" height="1.5" rx="0.75" fill="white" fillOpacity="0.78" />
          </svg>
        </button>
      </div>

      {/* Top-right: info + debug */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 p-3.5 flex flex-col items-end gap-2">
        {/* Info / legend */}
        <div className="relative">
          <LegendPanel open={legendOpen} />
          <button
            onClick={() => {
              setLegendOpen(o => !o);
              setFilterPanelOpen(false);
              if (controlsExpandedRef.current) {
                setControlsDismissing(true);
                setTimeout(() => setControlsDismissing(false), 75);
              }
              setControlsExpanded(false);
              controlsExpandedRef.current = false;
            }}
            className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 ${legendOpen ? "bg-yellow-400/90 text-black" : "bg-[#07111f]/65 text-white/70"}`}
            aria-label="Toggle legend"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="4.5" r="0.85" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Debug toggle */}
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

        <GpsLocationButton gpsActive={gpsActive} gpsStatus={gpsStatus} gpsMatch={gpsMatch} onClickAction={requestCurrentGpsPosition} />

        {/* Refresh status */}
        <RefreshButton onRefresh={handleRefreshStatus} />
      </div>

      <LayerControls
        controlsExpanded={controlsExpanded}
        controlsDismissing={controlsDismissing}
        pisteVisible={pisteVisible}
        pisteFilter={pisteFilter}
        filterPanelOpen={filterPanelOpen}
        liftVisible={liftVisible}
        gastronomyVisible={gastronomyVisible}
        webcamVisible={webcamVisible}
        infrastructureVisible={infrastructureVisible}
        sportFunVisible={sportFunVisible}
        onExpand={() => {
          setControlsExpanded(true);
          controlsExpandedRef.current = true;
          setLegendOpen(false);
          setFilterPanelOpen(false);
        }}
        onDismissAnimationComplete={() => { if (!controlsDismissing) return; setControlsDismissing(false); }}
        onToggleFilterPanel={() => setFilterPanelOpen(o => !o)}
        onToggleLifts={toggleLifts}
        onToggleDifficultyFilter={toggleDifficultyFilter}
        onToggleAllPistes={toggleAllPistes}
        onToggleGastronomy={toggleGastronomy}
        onToggleWebcam={toggleWebcam}
        onToggleInfrastructure={toggleInfrastructure}
        onToggleSportFun={toggleSportFun}
      />

      <InfoSheet selectedItem={selectedItem} onDismiss={() => setSelectedItem(null)} />

      {debugMode && (
        <MapDebugPanel
          debugMode={debugMode}
          debugStats={debugStats}
          debugPanelPos={debugPanelPos}
          debugAnchors={debugAnchors}
          debugSelectedAnchor={debugSelectedAnchor}
          gpsStatus={gpsStatus}
          gpsPos={gpsPos}
          gpsMatch={gpsMatch}
          activeAreaId={activeArea.id}
          maxScale={maxScale}
          // eslint-disable-next-line react-hooks/refs
          minScale={minScaleRef.current}
          panelRef={debugPanelRef}
          onSetDebugMode={setDebugMode}
          onZoomSliderChange={onZoomSliderChange}
          onSelectDebugAnchor={setDebugSelectedAnchor}
          onDebugPanelPointerDown={handleDebugPanelPointerDown}
          onDebugPanelPointerMove={handleDebugPanelPointerMove}
          onDebugPanelPointerUp={handleDebugPanelPointerUp}
        />
      )}

      <MapLoadErrorBanner loadError={loadError} activeAreaId={activeArea.id} />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        areas={RESORTS}
        activeAreaId={activeArea.id}
        currentArea={activeArea}
        onSelectArea={handleSelectArea}
      />
    </main>
  );
}
