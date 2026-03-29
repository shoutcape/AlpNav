"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import type { PanoramaLevel, PanoramaManifest } from "./types";
import { RESORTS, canActivateResort, resolveActiveResort } from "@/lib/resorts/catalog";
import { drawPisteOverlay } from "./overlays/drawPisteOverlay";
import { drawLiftOverlay } from "./overlays/drawLiftOverlay";
import { drawLabelOverlay } from "./overlays/drawLabelOverlay";
import { drawLiftMarkerOverlay } from "./overlays/drawLiftMarkerOverlay";
import { drawPisteMarkerOverlay } from "./overlays/drawPisteMarkerOverlay";
import { drawPisteHighlight, drawLiftHighlight, drawBadgeHighlight } from "./overlays/drawHighlightOverlay";
import { drawGastronomyMarkerOverlay } from "./overlays/drawGastronomyMarkerOverlay";
import { drawWebcamMarkerOverlay } from "./overlays/drawWebcamMarkerOverlay";
import { drawInfrastructureOverlay } from "./overlays/drawInfrastructureOverlay";
import { drawSportFunOverlay } from "./overlays/drawSportFunOverlay";
import { hitTestOverlays } from "./hitTest";
import { drawUserPositionOverlay } from "./overlays/drawUserPositionOverlay";
import { InfoSheet } from "./InfoSheet";
import { Drawer } from "./Drawer";
import type { ResortOverlayData, Piste, Lift, GastronomySpot, Webcam, InfrastructurePoi, SportFunPoi, PisteDifficulty } from "@/lib/domain/types";
import { useGeolocation } from "@/lib/geo/use-geolocation";
import type { GeoFix } from "@/lib/geo/use-geolocation";
import { loadOsmPistes } from "@/lib/geo/load-osm-pistes";
import { loadAnchorPoints } from "@/lib/geo/load-anchor-points";
import { matchRoutes } from "@/lib/geo/route-matcher";
import { GpsToPanoramaMapper } from "@/lib/geo/gps-to-panorama";
import type { ProjectionResult } from "@/lib/geo/gps-to-panorama";

// Minimum viewport scale at which each tier becomes visible.
// Scale 0.09 ≈ fully zoomed out on a 390px screen; ~2 ≈ fully zoomed in.
const LABEL_TIER_SCALES = [0, 0.25, 0.50, 0.85] as const;
const DIFFICULTIES: PisteDifficulty[] = ["easy", "medium", "difficult", "unknown"];

type MapShellProps = {
  initialAreaId: string;
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

const DEFAULT_PISTE_FILTER: Record<PisteDifficulty, boolean> = {
  easy: true,
  medium: true,
  difficult: true,
  unknown: true,
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
  const overlayDataRef = useRef<ResortOverlayData | null>(null);
  const pisteOverlayRef = useRef<Container | null>(null);
  const liftOverlayRef = useRef<Container | null>(null);
  const liftMarkerOverlayRef = useRef<Container | null>(null);
  const pisteMarkerRef = useRef<Container | null>(null);
  const pisteHighlightRef = useRef<Graphics | null>(null);
  const liftHighlightRef = useRef<Graphics | null>(null);
  const badgeHighlightRef = useRef<Graphics | null>(null);

  const userPositionOverlayRef = useRef<Container | null>(null);
  const mapperRef = useRef<GpsToPanoramaMapper | null>(null);
  const followLocationRef = useRef(false);

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

  const [selectedItem, setSelectedItem] = useState<Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi | null>(null);
  const [debugMode, setDebugMode] = useState<false | "normal" | "geo">(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("alpnav_debug_mode");
    if (saved === "normal" || saved === "geo") return saved;
    return false;
  });
  const debugModeRef = useRef<false | "normal" | "geo">(false);
  const debugLayerRef = useRef<Graphics | null>(null);
  const redrawDebugRef = useRef<(() => void) | null>(null);
  const [debugStats, setDebugStats] = useState<DebugStats | null>(null);
  const [followLocation, setFollowLocation] = useState(false);
  const [geoMapperStatus, setGeoMapperStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geoSegmentCount, setGeoSegmentCount] = useState(0);
  const [lastProjection, setLastProjection] = useState<ProjectionResult | null>(null);
  const [lastFix, setLastFix] = useState<GeoFix | null>(null);
  const [pickedPoint, setPickedPoint] = useState<{ px: number; py: number; geo: { lat: number; lng: number } | null; source: string } | null>(null);
  const [mockGeoInput, setMockGeoInput] = useState("47.2414193, 12.0377060");
  const [mockGeoActive, setMockGeoActive] = useState(false);
  const [simRoute, setSimRoute] = useState<string>(""); // route number
  const [simPlaying, setSimPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // index into flattened geo points
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minScaleRef = useRef(0.05);

  const { fix: geoFix, status: geoStatus } = useGeolocation(followLocation);

  const [loadedLevelCount, setLoadedLevelCount] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    setDrawerOpen(false);
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
    setFollowLocation(false);
    followLocationRef.current = false;
    setLoadError(null);
    setLastProjection(null);
    setLastFix(null);
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
        if (followLocationRef.current) {
          followLocationRef.current = false;
          setFollowLocation(false);
        }
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

      if (loadRequestIdRef.current === requestId) {
        setLoadError(null);
      }

      const overlayData = await activeArea.loadOverlayData();

      if (cancelled) {
        return;
      }

      overlayDataRef.current = overlayData;

      const pisteContainer = new Container();
      pisteContainer.label = "overlay-pistes";
      viewport.addChild(pisteContainer);
      pisteOverlayRef.current = pisteContainer;

      // Piste highlight — below lifts so lift lines render on top
      const pisteHighlight = new Graphics();
      pisteHighlight.label = "overlay-piste-highlight";
      viewport.addChild(pisteHighlight);
      pisteHighlightRef.current = pisteHighlight;

      const liftContainer = new Container();
      liftContainer.label = "overlay-lifts";
      drawLiftOverlay(liftContainer, overlayData.lifts, activeArea.visualScale);
      viewport.addChild(liftContainer);
      liftOverlayRef.current = liftContainer;

      // Lift highlight — above lifts so gold color overwrites the green inner
      const liftHighlight = new Graphics();
      liftHighlight.label = "overlay-lift-highlight";
      viewport.addChild(liftHighlight);
      liftHighlightRef.current = liftHighlight;

      const liftMarkerContainer = new Container();
      liftMarkerContainer.label = "overlay-lift-markers";
      drawLiftMarkerOverlay(liftMarkerContainer, overlayData.lifts, activeArea.visualScale);
      viewport.addChild(liftMarkerContainer);
      liftMarkerOverlayRef.current = liftMarkerContainer;

      const pisteMarkerContainer = new Container();
      pisteMarkerContainer.label = "overlay-piste-markers";
      viewport.addChild(pisteMarkerContainer);
      pisteMarkerRef.current = pisteMarkerContainer;

      // Draw per-difficulty sub-containers
      const linesByDiff = {} as Record<PisteDifficulty, Container>;
      const markersByDiff = {} as Record<PisteDifficulty, Container>;
      for (const diff of DIFFICULTIES) {
        const filtered = overlayData.pistes.filter(p => p.difficulty === diff);

        const lineSub = new Container();
        drawPisteOverlay(lineSub, filtered, activeArea.visualScale);
        pisteContainer.addChild(lineSub);
        linesByDiff[diff] = lineSub;

        const markerSub = new Container();
        drawPisteMarkerOverlay(markerSub, filtered, activeArea.visualScale);
        pisteMarkerContainer.addChild(markerSub);
        markersByDiff[diff] = markerSub;
      }
      pisteLinesByDiffRef.current = linesByDiff;
      pisteMarkersByDiffRef.current = markersByDiff;

      const gastronomyContainer = new Container();
      gastronomyContainer.label = "overlay-gastronomy";
      drawGastronomyMarkerOverlay(gastronomyContainer, overlayData.gastronomy, activeArea.visualScale);
      viewport.addChild(gastronomyContainer);
      gastronomyOverlayRef.current = gastronomyContainer;

      const webcamContainer = new Container();
      webcamContainer.label = "overlay-webcams";
      drawWebcamMarkerOverlay(webcamContainer, overlayData.webcams, activeArea.visualScale);
      viewport.addChild(webcamContainer);
      webcamOverlayRef.current = webcamContainer;

      const infrastructureContainer = new Container();
      infrastructureContainer.label = "overlay-infrastructure";
      drawInfrastructureOverlay(infrastructureContainer, overlayData.infrastructure, activeArea.visualScale);
      viewport.addChild(infrastructureContainer);
      infrastructureOverlayRef.current = infrastructureContainer;

      const sportFunContainer = new Container();
      sportFunContainer.label = "overlay-sport-fun";
      drawSportFunOverlay(sportFunContainer, overlayData.sportFun, activeArea.visualScale);
      viewport.addChild(sportFunContainer);
      sportFunOverlayRef.current = sportFunContainer;

      const labelContainer = new Container();
      labelContainer.label = "overlay-labels";
      const labelTiers = drawLabelOverlay(labelContainer, overlayData.labels);
      viewport.addChild(labelContainer);

      const badgeHighlight = new Graphics();
      badgeHighlight.label = "overlay-badge-highlight";
      viewport.addChild(badgeHighlight);
      badgeHighlightRef.current = badgeHighlight;

      // User position dot — above all overlays
      const userPosContainer = new Container();
      userPosContainer.label = "overlay-user-position";
      viewport.addChild(userPosContainer);
      userPositionOverlayRef.current = userPosContainer;

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
        for (const [zoom, container] of levelContainers) {
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
          loadedCount: loadedLevels.size,
          totalCount: manifest.levels.length,
        });
      };

      redrawDebugRef.current = redrawDebug;

      const firstLevel = manifest.levels[0];
      await loadLevelIntoViewport(
        tileLayer,
        levelContainers,
        firstLevel,
        levelTiles.get(firstLevel.remoteZoom) ?? [],
      );

      if (cancelled) {
        return;
      }

      loadedLevels.add(firstLevel.remoteZoom);
      setLoadedLevelCount(1);
      syncLevelBlend();

      await Promise.all(
        manifest.levels.slice(1).map(async (level) => {
          await loadLevelIntoViewport(tileLayer, levelContainers, level, levelTiles.get(level.remoteZoom) ?? []);
          if (cancelled) return;
          loadedLevels.add(level.remoteZoom);
          setLoadedLevelCount(loadedLevels.size);
          syncLevelBlend();
        }),
      );

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
          setFilterPanelOpen(false);
          return;
        }
        setFilterPanelOpen(false);
        setLegendOpen(false);

        // In geo debug mode, pick point for reverse projection
        if (debugModeRef.current === "geo" && mapperRef.current) {
          const result = mapperRef.current.reverseProject(world.x, world.y);
          setPickedPoint({
            px: world.x,
            py: world.y,
            geo: result?.geo ?? null,
            source: result?.source ?? "",
          });

          // Draw pick marker on debug layer
          const g = debugLayerRef.current;
          const vp = viewportRef.current;
          if (g && vp) {
            g.clear();
            const s = 12 / vp.scale.x; // constant screen size
            const lw = 2 / vp.scale.x;
            // Crosshair
            g.moveTo(world.x - s, world.y).lineTo(world.x + s, world.y);
            g.moveTo(world.x, world.y - s).lineTo(world.x, world.y + s);
            g.stroke({ width: lw, color: 0xff3366 });
            // Circle
            g.circle(world.x, world.y, s * 0.6);
            g.stroke({ width: lw, color: 0xff3366 });
          }
          return;
        }

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

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (wheelPanHandler && appRef.current?.canvas) {
        appRef.current.canvas.removeEventListener("wheel", wheelPanHandler, { capture: true });
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
      pisteHighlightRef.current = null;
      liftHighlightRef.current = null;
      badgeHighlightRef.current = null;
      gastronomyOverlayRef.current = null;
      webcamOverlayRef.current = null;
      infrastructureOverlayRef.current = null;
      sportFunOverlayRef.current = null;
      pisteLinesByDiffRef.current = null;
      pisteMarkersByDiffRef.current = null;

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

  // Auto-apply default mock GPS when mapper becomes ready
  useEffect(() => {
    if (geoMapperStatus !== "ready" || mockGeoActive) return;
    const parts = mockGeoInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return;
    const [lat, lng] = parts;
    setMockGeoActive(true);
    setLastFix({ position: { lat, lng }, accuracy: 5, altitude: null, heading: null, speed: null, timestamp: Date.now() });
    projectAndDraw(lat, lng, 5);
  }, [geoMapperStatus]);

  // Load OSM pistes and build mapper when resort changes
  useEffect(() => {
    let cancelled = false;
    mapperRef.current = null;
    setGeoMapperStatus("loading");
    setGeoSegmentCount(0);
    setLastProjection(null);

    if (!activeArea.bbox) {
      setGeoMapperStatus("idle");
      return;
    }

    const build = async () => {
      try {
        const [osmPistes, anchorPoints] = await Promise.all([
          loadOsmPistes(activeArea.id),
          loadAnchorPoints(activeArea.id).catch(() => []),
        ]);
        if (cancelled) return;

        // Wait for overlay data to be available
        const waitForOverlays = () =>
          new Promise<void>((resolve) => {
            const check = () => {
              if (overlayDataRef.current || cancelled) return resolve();
              setTimeout(check, 100);
            };
            check();
          });
        await waitForOverlays();
        if (cancelled || !overlayDataRef.current) return;

        const mapped = matchRoutes(overlayDataRef.current.pistes, osmPistes);
        const mapper = new GpsToPanoramaMapper(mapped, anchorPoints);
        if (cancelled) return;

        mapperRef.current = mapper;
        setGeoSegmentCount(mapper.segmentCount);
        setGeoMapperStatus("ready");
        console.log(`[geo] Mapper ready: ${mapped.length} routes, ${mapper.segmentCount} segments, ${mapper.anchorCount} anchors`);
      } catch (err) {
        if (!cancelled) {
          console.error("[geo] Failed to build mapper:", err);
          setGeoMapperStatus("error");
        }
      }
    };

    build();
    return () => { cancelled = true; };
  }, [activeArea.id, activeArea.bbox]);

  // Project a geo position to panorama and update the user dot
  const projectAndDraw = (lat: number, lng: number, _accuracy: number) => {
    const mapper = mapperRef.current;
    if (!mapper) return;

    const result = mapper.project({ lat, lng });
    setLastProjection(result);

    if (result && userPositionOverlayRef.current) {
      const isAnchor = !!result.anchorName;
      drawUserPositionOverlay(
        userPositionOverlayRef.current,
        result.point,
        activeArea.visualScale,
        isAnchor,
        followLocationRef.current,
      );

      if (followLocationRef.current && viewportRef.current) {
        viewportRef.current.moveCenter(result.point.x, result.point.y);
      }
    } else if (userPositionOverlayRef.current) {
      drawUserPositionOverlay(userPositionOverlayRef.current, null, activeArea.visualScale);
    }
  };

  // Project real GPS fix to panorama
  useEffect(() => {
    if (mockGeoActive) return; // mock overrides real GPS
    if (!geoFix) {
      setLastFix(null);
      setLastProjection(null);
      if (userPositionOverlayRef.current) {
        drawUserPositionOverlay(userPositionOverlayRef.current, null, activeArea.visualScale);
      }
      return;
    }

    setLastFix(geoFix);
    projectAndDraw(geoFix.position.lat, geoFix.position.lng, geoFix.accuracy);
  }, [geoFix, activeArea.visualScale, mockGeoActive]);

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

  const isLoading = loadedLevelCount < manifest.levels.length;

  const HIDDEN_ALPHA = 0.15;

  const toggleLifts = () => {
    const next = !liftVisible;
    setLiftVisible(next);
    liftVisibleRef.current = next;
    if (liftOverlayRef.current) liftOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
    if (liftMarkerOverlayRef.current) liftMarkerOverlayRef.current.visible = next;
  };

  const toggleDifficultyFilter = (diff: PisteDifficulty) => {
    const next = { ...pisteFilterRef.current, [diff]: !pisteFilterRef.current[diff] };
    setPisteFilter(next);
    pisteFilterRef.current = next;

    const enabled = next[diff];
    if (pisteLinesByDiffRef.current) pisteLinesByDiffRef.current[diff].alpha = enabled ? 1 : HIDDEN_ALPHA;
    if (pisteMarkersByDiffRef.current) pisteMarkersByDiffRef.current[diff].visible = enabled;

    // If turning a filter on while the master switch is off, restore the parent
    // and explicitly dim all other off-filters (they were at alpha 1 with parent hiding them)
    if (enabled && !pisteVisibleRef.current) {
      setPisteVisible(true);
      pisteVisibleRef.current = true;
      if (pisteOverlayRef.current) pisteOverlayRef.current.alpha = 1;
      if (pisteMarkerRef.current) pisteMarkerRef.current.visible = true;
      for (const d of DIFFICULTIES) {
        if (d === diff) continue;
        if (pisteLinesByDiffRef.current) pisteLinesByDiffRef.current[d].alpha = next[d] ? 1 : HIDDEN_ALPHA;
        if (pisteMarkersByDiffRef.current) pisteMarkersByDiffRef.current[d].visible = next[d];
      }
    }
  };

  const toggleAllPistes = () => {
    const allOn = pisteVisibleRef.current && DIFFICULTIES.every(d => pisteFilterRef.current[d]);
    const turnOn = !allOn;
    setPisteVisible(turnOn);
    pisteVisibleRef.current = turnOn;
    if (pisteOverlayRef.current) pisteOverlayRef.current.alpha = turnOn ? 1 : HIDDEN_ALPHA;
    if (pisteMarkerRef.current) pisteMarkerRef.current.visible = turnOn;

    const next = { easy: turnOn, medium: turnOn, difficult: turnOn, unknown: turnOn } as Record<PisteDifficulty, boolean>;
    setPisteFilter(next);
    pisteFilterRef.current = next;
    for (const diff of DIFFICULTIES) {
      // When turning off, parent handles hiding — reset children to 1 to avoid compounding.
      // When turning on, children are all on (next[diff] === true).
      if (pisteLinesByDiffRef.current) pisteLinesByDiffRef.current[diff].alpha = 1;
      if (pisteMarkersByDiffRef.current) pisteMarkersByDiffRef.current[diff].visible = turnOn;
    }
  };

  const toggleGastronomy = () => {
    const next = !gastronomyVisible;
    setGastronomyVisible(next);
    gastronomyVisibleRef.current = next;
    if (gastronomyOverlayRef.current)
      gastronomyOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
  };

  const toggleInfrastructure = () => {
    const next = !infrastructureVisible;
    setInfrastructureVisible(next);
    infrastructureVisibleRef.current = next;
    if (infrastructureOverlayRef.current)
      infrastructureOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
  };

  const toggleSportFun = () => {
    const next = !sportFunVisible;
    setSportFunVisible(next);
    sportFunVisibleRef.current = next;
    if (sportFunOverlayRef.current) sportFunOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
  };

  const toggleWebcam = () => {
    const next = !webcamVisible;
    setWebcamVisible(next);
    webcamVisibleRef.current = next;
    if (webcamOverlayRef.current)
      webcamOverlayRef.current.alpha = next ? 1 : HIDDEN_ALPHA;
  };

  const toggleDebug = () => setDebugMode((currentMode) => (currentMode === false ? "normal" : false));

  const applyMockGeo = () => {
    const parts = mockGeoInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return;
    const [lat, lng] = parts;
    setMockGeoActive(true);
    setLastFix({ position: { lat, lng }, accuracy: 5, altitude: null, heading: null, speed: null, timestamp: Date.now() });
    projectAndDraw(lat, lng, 5);
  };

  const clearMockGeo = () => {
    setMockGeoActive(false);
    stopSim();
    setLastProjection(null);
    if (userPositionOverlayRef.current) {
      drawUserPositionOverlay(userPositionOverlayRef.current, null, activeArea.visualScale);
    }
  };

  /** Flatten all geo points for the selected simulation route */
  const getSimPoints = () => {
    const mapper = mapperRef.current;
    if (!mapper || !simRoute) return [];
    const route = mapper.routes.find((r) => r.number === simRoute);
    if (!route) return [];
    return route.segments.flatMap((s) => s.geoPoints);
  };

  const startSim = () => {
    const pts = getSimPoints();
    if (pts.length === 0) return;
    stopSim();
    setMockGeoActive(true);
    setSimPlaying(true);
    setSimProgress(0);
    // Apply first point immediately
    const p = pts[0];
    setLastFix({ position: p, accuracy: 5, altitude: null, heading: null, speed: null, timestamp: Date.now() });
    setMockGeoInput(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
    projectAndDraw(p.lat, p.lng, 5);

    let idx = 1;
    simIntervalRef.current = setInterval(() => {
      if (idx >= pts.length) {
        stopSim();
        return;
      }
      const pt = pts[idx];
      setSimProgress(idx);
      setLastFix({ position: pt, accuracy: 5, altitude: null, heading: null, speed: null, timestamp: Date.now() });
      setMockGeoInput(`${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}`);
      projectAndDraw(pt.lat, pt.lng, 5);
      idx++;
    }, 200);
  };

  const stopSim = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setSimPlaying(false);
  };

  const toggleFollowLocation = () => setFollowLocation(f => {
    const next = !f;
    followLocationRef.current = next;
    // If enabling follow and we already have a projected position, center and redraw with halo
    if (lastProjection && userPositionOverlayRef.current) {
      drawUserPositionOverlay(
        userPositionOverlayRef.current,
        lastProjection.point,
        activeArea.visualScale,
        !!lastProjection.anchorName,
        next,
      );
      if (next && viewportRef.current) {
        viewportRef.current.moveCenter(lastProjection.point.x, lastProjection.point.y);
      }
    }
    return next;
  });

  const onZoomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const t = parseFloat(e.target.value);
    const logMin = Math.log(minScaleRef.current);
    const logMax = Math.log(maxScale);
    vp.scaled = Math.exp(logMin + t * (logMax - logMin));
    vp.emit("moved", { type: "wheel", viewport: vp });
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

        {/* Follow location toggle */}
        <button
          onClick={toggleFollowLocation}
          className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color] active:scale-95 ${
            geoStatus === "denied" || geoStatus === "unavailable"
              ? "bg-red-400/70 text-black/80"
              : followLocation
                ? geoStatus === "active" && lastProjection
                  ? "bg-blue-400/90 text-black"
                  : "bg-blue-400/50 text-black/60 animate-pulse"
                : "bg-[#07111f]/65 text-white/70"
          }`}
          aria-label="Toggle follow location"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="2.5" fill="currentColor" />
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="8" y1="1" x2="8" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="8" x2="3.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Bottom: primary map controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-8">
        <motion.div
          layout
          className="pointer-events-auto overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#07111f]/68 p-1.5 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
          transition={{ layout: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }}
        >
          {!controlsExpanded ? (
            <button
              onClick={() => {
                setControlsExpanded(true);
                controlsExpandedRef.current = true;
                setLegendOpen(false);
                setFilterPanelOpen(false);
              }}
              aria-expanded={controlsExpanded}
              aria-label="Map layer controls"
              onContextMenu={e => e.preventDefault()}
              className="touch-none select-none flex flex-col items-center gap-1 rounded-[14px] px-4 py-2 text-ivory/70 hover:bg-white/[0.07] hover:text-ivory"
            >
              <LayersIcon />
              <DifficultyDots pisteVisible={pisteVisible} pisteFilter={pisteFilter} />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">Layers</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              <MapControlButton icon={<LiftIcon />} label="Lifts" active={liftVisible} onClick={toggleLifts} />
              <div className="relative">
                <DifficultyFilterPanel filter={pisteFilter} open={filterPanelOpen} onToggle={toggleDifficultyFilter} onToggleAll={toggleAllPistes} />
                <button
                  onClick={() => setFilterPanelOpen(o => !o)}
                  onContextMenu={e => e.preventDefault()}
                  className={`touch-none select-none flex w-full flex-col items-center gap-1 rounded-[16px] px-5 py-2.5 ${pisteVisible || filterPanelOpen ? "bg-white/[0.11] text-ivory" : "text-ivory/40 hover:bg-white/[0.07] hover:text-ivory/70"}`}
                >
                  <SlopeIcon />
                  <DifficultyDots pisteVisible={pisteVisible} pisteFilter={pisteFilter} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">Slopes</span>
                </button>
              </div>
              <MapControlButton icon={<GastronomyMapIcon />} label="Food" active={gastronomyVisible} onClick={toggleGastronomy} />
              <MapControlButton icon={<WebcamMapIcon />} label="Webcams" active={webcamVisible} onClick={toggleWebcam} />
              <MapControlButton icon={<InfrastructureMapIcon />} label="Info" active={infrastructureVisible} onClick={toggleInfrastructure} />
              <MapControlButton icon={<SportFunMapIcon />} label="Sport" active={sportFunVisible} onClick={toggleSportFun} />
            </div>
          )}
        </motion.div>
      </div>

      <InfoSheet selectedItem={selectedItem} onDismiss={() => setSelectedItem(null)} />

      {debugMode && (
        <div className="absolute bottom-4 left-4 z-50 rounded bg-black/70 p-2 font-mono text-xs text-white space-y-1.5 w-64 pointer-events-auto">
          <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-white/50">Debug</span>
            <div className="flex gap-1">
              <button
                onClick={() => setDebugMode("normal")}
                className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition-colors ${debugMode === "normal" ? "bg-yellow-400/90 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                aria-label="Show normal debug mode"
              >
                normal
              </button>
              <button
                onClick={() => setDebugMode("geo")}
                className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition-colors ${debugMode === "geo" ? "bg-yellow-400/90 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                aria-label="Show geo debug mode"
              >
                geo
              </button>
            </div>
          </div>

          {debugMode === "normal" && debugStats && (
            <>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                // eslint-disable-next-line react-hooks/refs
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
            </>
          )}

          {debugMode === "geo" && (
            <div className="space-y-1.5">
              <div className="space-y-0.5 pointer-events-none">
                <div>mapper: {geoMapperStatus} ({geoSegmentCount} segs, {mapperRef.current?.anchorCount ?? 0} anchors)</div>
                <div>gps: {geoStatus}{lastFix ? ` ±${lastFix.accuracy.toFixed(0)}m` : ""}</div>
              </div>

              {/* Current location */}
              {lastFix && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 shrink-0">loc:</span>
                  <span className="text-[10px] text-white/70 truncate">{lastFix.position.lat.toFixed(5)}, {lastFix.position.lng.toFixed(5)}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${lastFix.position.lat.toFixed(6)}, ${lastFix.position.lng.toFixed(6)}`)}
                    className="shrink-0 rounded px-1 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                    aria-label="Copy coordinates"
                  >
                    copy
                  </button>
                </div>
              )}

              {/* Mock GPS input */}
              <div className="border-t border-white/10 pt-1.5">
                <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">mock gps</div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={mockGeoInput}
                    onChange={(e) => setMockGeoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyMockGeo(); } }}
                    placeholder="lat, lng"
                    className="flex-1 min-w-0 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white placeholder:text-white/30 outline-none focus:bg-white/15"
                  />
                  <button
                    onClick={applyMockGeo}
                    className="shrink-0 rounded bg-blue-500/80 px-2 py-1 text-[10px] text-white hover:bg-blue-500 transition-colors"
                  >
                    set
                  </button>
                  {mockGeoActive && (
                    <button
                      onClick={clearMockGeo}
                      className="shrink-0 rounded bg-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/20 transition-colors"
                    >
                      clear
                    </button>
                  )}
                </div>
                <div className="text-[10px] mt-0.5 h-4">
                  {mockGeoActive && (
                    <span className="text-yellow-400/80">mock active</span>
                  )}
                </div>
              </div>

              {/* Route simulation */}
              {geoMapperStatus === "ready" && mapperRef.current && (
                <div className="border-t border-white/10 pt-1.5">
                  <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">simulate route</div>
                  <div className="flex gap-1 items-center">
                    <select
                      value={simRoute}
                      onChange={(e) => { stopSim(); setSimRoute(e.target.value); }}
                      className="flex-1 min-w-0 rounded bg-white/10 px-1.5 py-1 text-[10px] text-white outline-none focus:bg-white/15"
                    >
                      <option value="" className="bg-[#111]">select route</option>
                      {mapperRef.current.routes
                        .slice()
                        .sort((a, b) => {
                          const na = parseInt(a.number), nb = parseInt(b.number);
                          if (!isNaN(na) && !isNaN(nb)) return na - nb;
                          return a.number.localeCompare(b.number);
                        })
                        .map((r) => (
                          <option key={r.pisteId} value={r.number} className="bg-[#111]">
                            {r.number} ({r.segments.length} seg, {r.segments.reduce((n, s) => n + s.geoPoints.length, 0)} pts)
                          </option>
                        ))}
                    </select>
                    {!simPlaying ? (
                      <button
                        onClick={startSim}
                        disabled={!simRoute}
                        className="shrink-0 rounded bg-green-500/80 px-2 py-1 text-[10px] text-white hover:bg-green-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ▶
                      </button>
                    ) : (
                      <button
                        onClick={stopSim}
                        className="shrink-0 rounded bg-red-500/80 px-2 py-1 text-[10px] text-white hover:bg-red-500 transition-colors"
                      >
                        ■
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5 h-4">
                    {simPlaying && (
                      <span className="text-green-400/80">simulating: {simProgress + 1}/{getSimPoints().length}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Projection result */}
              {lastProjection ? (
                <div className="space-y-0.5 pointer-events-none border-t border-white/10 pt-1.5">
                  <div>proj: {lastProjection.point.x.toFixed(1)}, {lastProjection.point.y.toFixed(1)}</div>
                  {lastProjection.anchorName ? (
                    <div className="text-green-400/90">anchor: {lastProjection.anchorName} ({lastProjection.distance.toFixed(0)}m)</div>
                  ) : (
                    <div>route: {lastProjection.routeNumber} ({lastProjection.distance.toFixed(0)}m)</div>
                  )}
                  <div className="text-[9px] text-white/40 truncate">seg: {lastProjection.segmentId}</div>
                </div>
              ) : (followLocation || mockGeoActive) ? (
                <div className="text-white/40 pointer-events-none">no route match</div>
              ) : null}

              {/* Picked point (click-to-inspect) */}
              {pickedPoint && (
                <div className="border-t border-white/10 pt-1.5 space-y-0.5">
                  <div className="text-[9px] uppercase tracking-widest text-white/40">picked point</div>
                  <div className="pointer-events-none">pano: {pickedPoint.px.toFixed(0)}, {pickedPoint.py.toFixed(0)}</div>
                  {pickedPoint.geo ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="pointer-events-none">{pickedPoint.geo.lat.toFixed(6)}, {pickedPoint.geo.lng.toFixed(6)}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(`${pickedPoint.geo!.lat.toFixed(6)}, ${pickedPoint.geo!.lng.toFixed(6)}`)}
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                        >
                          copy
                        </button>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${pickedPoint.geo!.lat.toFixed(6)}&mlon=${pickedPoint.geo!.lng.toFixed(6)}#map=17/${pickedPoint.geo!.lat.toFixed(6)}/${pickedPoint.geo!.lng.toFixed(6)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] text-blue-400/80 hover:bg-white/10 hover:text-blue-300 transition-colors"
                        >
                          OSM
                        </a>
                      </div>
                      <div className="text-[9px] text-white/40 truncate">via: {pickedPoint.source}</div>
                    </>
                  ) : (
                    <div className="text-white/40">no geo match</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loadError && (
        <div className="pointer-events-none absolute inset-x-4 top-16 z-30 rounded-[18px] border border-red-300/30 bg-red-950/85 px-4 py-3 text-sm text-red-50 shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-200/80">Area load failed</p>
          {process.env.NODE_ENV !== "production" ? (
            <>
              <p className="mt-1 break-words text-red-50/95">{loadError}</p>
              <p className="mt-2 text-xs text-red-100/70">Active area: {activeArea.id}</p>
            </>
          ) : (
            <p className="mt-1 text-red-50/95">Unable to load this area. Please refresh and try again.</p>
          )}
        </div>
      )}

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

function DifficultyDots({ pisteVisible, pisteFilter }: { pisteVisible: boolean; pisteFilter: Record<string, boolean> }) {
  return (
    <div className="flex gap-[3px] items-center h-[5px]">
      {DIFFICULTIES.map(diff => (
        <span
          key={diff}
          className="w-[5px] h-[5px] rounded-full"
          style={{
            backgroundColor: DIFFICULTY_CSS_COLORS[diff],
            opacity: pisteVisible && pisteFilter[diff] ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

function MapControlButton({ icon, label, active, onClick, onPointerDown, onPointerUp, onPointerLeave }: {
  icon: React.ReactNode; label: string; active: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={e => e.preventDefault()}
      className={`touch-none select-none flex w-full flex-col items-center gap-1.5 rounded-[16px] px-5 py-2.5 ${active ? "bg-white/[0.11] text-ivory" : "text-ivory/40 hover:bg-white/[0.07] hover:text-ivory/70"}`}
    >
      {icon}
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-current">{label}</span>
    </button>
  );
}

const DIFFICULTY_LABELS: Record<PisteDifficulty, string> = {
  easy: "Easy", medium: "Med", difficult: "Hard", unknown: "Other"
};
const DIFFICULTY_CSS_COLORS: Record<PisteDifficulty, string> = {
  easy: "#0069ea", medium: "#ff0000", difficult: "#444444", unknown: "#9e9e9e"
};

function DifficultyFilterPanel({ filter, open, onToggle, onToggleAll }: {
  filter: Record<PisteDifficulty, boolean>;
  open: boolean;
  onToggle: (d: PisteDifficulty) => void;
  onToggleAll: () => void;
}) {
  const activeCount = DIFFICULTIES.filter(d => filter[d]).length;
  const allOpacity = activeCount === DIFFICULTIES.length ? "opacity-100" : "opacity-30";
  const allBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) allBtnRef.current?.focus();
  }, [open]);

  return (
    <div inert={!open || undefined} className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex gap-1 rounded-[18px] border border-white/[0.09] bg-[#07111f]/68 p-1.5 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      <button
        ref={allBtnRef}
        onClick={onToggleAll}
        className={`flex flex-col items-center gap-1 rounded-[12px] px-3 py-2 transition-[transform,opacity] active:scale-[0.96] ${allOpacity}`}
      >
        <span className="w-4 h-4 rounded-full bg-white ring-1 ring-black" />
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ivory">All</span>
      </button>
      <div className="w-px self-stretch bg-white/[0.08] mx-0.5" />
      {DIFFICULTIES.map(diff => (
        <button
          key={diff}
          onClick={() => onToggle(diff)}
          className={`flex flex-col items-center gap-1 rounded-[12px] px-3 py-2 transition-[transform,opacity] active:scale-[0.96] ${filter[diff] ? "opacity-100" : "opacity-30"}`}
        >
          <span className="w-4 h-4 rounded-full ring-1 ring-black" style={{ backgroundColor: DIFFICULTY_CSS_COLORS[diff] }} />
          <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ivory">{DIFFICULTY_LABELS[diff]}</span>
        </button>
      ))}
    </div>
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

function LayersIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 24 20" fill="none" aria-hidden="true">
      <line x1="3" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="16" r="2.5" fill="#07111f" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LegendPanel({ open }: { open: boolean }) {
  return (
    <div className={`select-none absolute right-0 top-full z-20 mt-2 w-[220px] rounded-[18px] border border-white/[0.09] bg-[#07111f]/85 p-4 shadow-[0_8px_36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      {/* Slopes */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Slopes</p>
      {([
        { color: "#0069ea", letter: "B", label: "Easy" },
        { color: "#ff0000", letter: "R", label: "Medium" },
        { color: "#444444", letter: "S", label: "Difficult" },
      ] as const).map(({ color, letter, label }) => (
        <div key={label} className="flex items-center gap-2.5 py-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: color }}>{letter}</span>
          <span className="text-[12px] text-ivory">{label}</span>
        </div>
      ))}

      <div className="my-3 h-px bg-white/[0.07]" />

      {/* Lifts */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Lifts</p>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-5" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <rect x="-3" y="-11" width="6" height="3" rx="1" fill="white" />
            <line x1="-1.5" y1="-8" x2="-5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1.5" y1="-8" x2="5" y2="-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="-8" y="-3" width="16" height="3" stroke="white" strokeWidth="1.5" />
            <rect x="-8" y="0" width="16" height="12" rx="2" stroke="white" strokeWidth="1.5" />
            <rect x="-7" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
            <rect x="2" y="2" width="5" height="7" rx="1" stroke="white" strokeWidth="1" strokeOpacity="0.6" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Gondola</span>
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-8" x2="13" y2="-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="-10" r="3" fill="white" />
            <line x1="0" y1="-7" x2="0" y2="0" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <rect x="-10" y="0" width="20" height="11" rx="2" stroke="white" strokeWidth="1.5" />
            <line x1="1" y1="11" x2="6" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Chairlift</span>
      </div>
      <div className="flex items-center gap-2.5 py-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e]">
          <svg width="12" height="12" viewBox="-24 -24 48 48" fill="none" aria-hidden="true">
            <line x1="-13" y1="-8" x2="13" y2="-14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="-11" r="2.5" fill="white" />
            <line x1="0" y1="-8.5" x2="0" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <line x1="-6" y1="9" x2="6" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[12px] text-ivory">Drag Lift</span>
      </div>

      <div className="my-3 h-px bg-white/[0.07]" />

      {/* Food */}
      <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-ivory/40 mb-2">Food &amp; Drink</p>
      {([
        { color: "#e8a020", label: "Mountain Restaurant" },
        { color: "#9b4dca", label: "Bar / Après-ski" },
        { color: "#20a090", label: "Café" },
      ] as const).map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2.5 py-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            <svg width="10" height="10" viewBox="-8 -8 16 16" fill="none" aria-hidden="true">
              <line x1="-3.5" y1="-7" x2="-3.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="-2" y1="-7" x2="-2" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="-0.5" y1="-7" x2="-0.5" y2="-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M-3.5,-3 Q-2,-1.5 -0.5,-3" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <line x1="-2" y1="-1.5" x2="-2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M2,-7 L3,-4 L2,-2.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="2" y1="-2.5" x2="2" y2="7" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[12px] text-ivory">{label}</span>
        </div>
      ))}
    </div>
  );
}

function GastronomyMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Fork tines */}
      <line x1="-4.5" y1="-8" x2="-4.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-2.5" y1="-8" x2="-2.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="-0.5" y1="-8" x2="-0.5" y2="-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Fork arch */}
      <path d="M-4.5,-3 Q-2.5,-1 -0.5,-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Fork handle */}
      <line x1="-2.5" y1="-1.5" x2="-2.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Knife blade */}
      <path d="M2.5,-8 L4,-4 L2.5,-2.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Knife handle */}
      <line x1="2.5" y1="-2.5" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WebcamMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Camera body */}
      <rect x="-9" y="-5" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {/* Lens */}
      <circle cx="0" cy="0.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Viewfinder bump */}
      <rect x="-4" y="-8" width="5" height="3" rx="1" fill="currentColor" />
    </svg>
  );
}

function InfrastructureMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      {/* Map pin outline */}
      <path d="M0,-9 C-5,-9 -7,-5 -7,-2 C-7,3 0,9 0,9 C0,9 7,3 7,-2 C7,-5 5,-9 0,-9 Z" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner circle */}
      <circle cx="0" cy="-2" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SportFunMapIcon() {
  return (
    <svg width="22" height="20" viewBox="-11 -10 22 20" fill="none" aria-hidden="true">
      <polygon
        points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon points="-3,-4 6,0 -3,4" fill="currentColor" opacity="0.8" />
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
        src: buildTileUrl(manifest.localTemplate, level.remoteZoom, x, y),
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

function buildTileUrl(template: string, remoteZoom: number, x: number, y: number) {
  return template
    .replaceAll("{z}", String(remoteZoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
