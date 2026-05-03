import { Container, Graphics } from "pixi.js";
import type { ResortOverlayData, PisteDifficulty } from "@/lib/domain/types";
import { DIFFICULTIES } from "./map-constants";
import { drawGastronomyMarkerOverlay } from "./overlays/drawGastronomyMarkerOverlay";
import { drawInfrastructureOverlay } from "./overlays/drawInfrastructureOverlay";
import { drawLabelOverlay } from "./overlays/drawLabelOverlay";
import { drawLiftMarkerOverlay } from "./overlays/drawLiftMarkerOverlay";
import { drawLiftOverlay } from "./overlays/drawLiftOverlay";
import { drawPisteMarkerOverlay } from "./overlays/drawPisteMarkerOverlay";
import { drawPisteOverlay } from "./overlays/drawPisteOverlay";
import { drawSportFunOverlay } from "./overlays/drawSportFunOverlay";
import { drawWebcamMarkerOverlay } from "./overlays/drawWebcamMarkerOverlay";

export const HIDDEN_LAYER_ALPHA = 0.15;

export type MapLayerRefs = {
  pisteOverlay: Container | null;
  liftOverlay: Container | null;
  liftMarkerOverlay: Container | null;
  pisteMarkerOverlay: Container | null;
  pisteHighlight: Graphics | null;
  liftHighlight: Graphics | null;
  badgeHighlight: Graphics | null;
  gastronomyOverlay: Container | null;
  webcamOverlay: Container | null;
  infrastructureOverlay: Container | null;
  sportFunOverlay: Container | null;
  gpsDot: Graphics | null;
  debugDot: Graphics | null;
  debugLayer: Graphics | null;
  pisteLinesByDiff: Record<PisteDifficulty, Container> | null;
  pisteMarkersByDiff: Record<PisteDifficulty, Container> | null;
};

type CreateMapLayersOptions = {
  viewport: Container;
  overlayData: ResortOverlayData;
  visualScale?: number;
};

export function createEmptyMapLayerRefs(): MapLayerRefs {
  return {
    pisteOverlay: null,
    liftOverlay: null,
    liftMarkerOverlay: null,
    pisteMarkerOverlay: null,
    pisteHighlight: null,
    liftHighlight: null,
    badgeHighlight: null,
    gastronomyOverlay: null,
    webcamOverlay: null,
    infrastructureOverlay: null,
    sportFunOverlay: null,
    gpsDot: null,
    debugDot: null,
    debugLayer: null,
    pisteLinesByDiff: null,
    pisteMarkersByDiff: null,
  };
}

export function createMapLayers({ viewport, overlayData, visualScale = 1 }: CreateMapLayersOptions) {
  const refs = createEmptyMapLayerRefs();

  const pisteContainer = new Container();
  pisteContainer.label = "overlay-pistes";
  viewport.addChild(pisteContainer);
  refs.pisteOverlay = pisteContainer;

  const pisteHighlight = new Graphics();
  pisteHighlight.label = "overlay-piste-highlight";
  viewport.addChild(pisteHighlight);
  refs.pisteHighlight = pisteHighlight;

  const liftContainer = new Container();
  liftContainer.label = "overlay-lifts";
  drawLiftOverlay(liftContainer, overlayData.lifts, visualScale);
  viewport.addChild(liftContainer);
  refs.liftOverlay = liftContainer;

  const liftHighlight = new Graphics();
  liftHighlight.label = "overlay-lift-highlight";
  viewport.addChild(liftHighlight);
  refs.liftHighlight = liftHighlight;

  const liftMarkerContainer = new Container();
  liftMarkerContainer.label = "overlay-lift-markers";
  drawLiftMarkerOverlay(liftMarkerContainer, overlayData.lifts, visualScale);
  viewport.addChild(liftMarkerContainer);
  refs.liftMarkerOverlay = liftMarkerContainer;

  const pisteMarkerContainer = new Container();
  pisteMarkerContainer.label = "overlay-piste-markers";
  viewport.addChild(pisteMarkerContainer);
  refs.pisteMarkerOverlay = pisteMarkerContainer;

  const linesByDiff = {} as Record<PisteDifficulty, Container>;
  const markersByDiff = {} as Record<PisteDifficulty, Container>;
  for (const diff of DIFFICULTIES) {
    const filtered = overlayData.pistes.filter((piste) => piste.difficulty === diff);

    const lineSub = new Container();
    drawPisteOverlay(lineSub, filtered, visualScale);
    pisteContainer.addChild(lineSub);
    linesByDiff[diff] = lineSub;

    const markerSub = new Container();
    drawPisteMarkerOverlay(markerSub, filtered, visualScale);
    pisteMarkerContainer.addChild(markerSub);
    markersByDiff[diff] = markerSub;
  }
  refs.pisteLinesByDiff = linesByDiff;
  refs.pisteMarkersByDiff = markersByDiff;

  const gastronomyContainer = new Container();
  gastronomyContainer.label = "overlay-gastronomy";
  drawGastronomyMarkerOverlay(gastronomyContainer, overlayData.gastronomy, visualScale);
  viewport.addChild(gastronomyContainer);
  refs.gastronomyOverlay = gastronomyContainer;

  const webcamContainer = new Container();
  webcamContainer.label = "overlay-webcams";
  drawWebcamMarkerOverlay(webcamContainer, overlayData.webcams, visualScale);
  viewport.addChild(webcamContainer);
  refs.webcamOverlay = webcamContainer;

  const infrastructureContainer = new Container();
  infrastructureContainer.label = "overlay-infrastructure";
  drawInfrastructureOverlay(infrastructureContainer, overlayData.infrastructure, visualScale);
  viewport.addChild(infrastructureContainer);
  refs.infrastructureOverlay = infrastructureContainer;

  const sportFunContainer = new Container();
  sportFunContainer.label = "overlay-sport-fun";
  drawSportFunOverlay(sportFunContainer, overlayData.sportFun, visualScale);
  viewport.addChild(sportFunContainer);
  refs.sportFunOverlay = sportFunContainer;

  const labelContainer = new Container();
  labelContainer.label = "overlay-labels";
  const labelTiers = drawLabelOverlay(labelContainer, overlayData.labels);
  viewport.addChild(labelContainer);

  const badgeHighlight = new Graphics();
  badgeHighlight.label = "overlay-badge-highlight";
  viewport.addChild(badgeHighlight);
  refs.badgeHighlight = badgeHighlight;

  const gpsDot = new Graphics();
  gpsDot.label = "gps-location-dot";
  viewport.addChild(gpsDot);
  refs.gpsDot = gpsDot;

  const debugDot = new Graphics();
  debugDot.label = "debug-anchor-dot";
  viewport.addChild(debugDot);
  refs.debugDot = debugDot;

  const debugLayer = new Graphics();
  debugLayer.label = "debug-layer";
  debugLayer.visible = false;
  viewport.addChild(debugLayer);
  refs.debugLayer = debugLayer;

  return { refs, labelTiers };
}

export function applyLiftVisibility(refs: MapLayerRefs, visible: boolean): void {
  if (refs.liftOverlay) refs.liftOverlay.alpha = visible ? 1 : HIDDEN_LAYER_ALPHA;
  if (refs.liftMarkerOverlay) refs.liftMarkerOverlay.visible = visible;
}

export function applyPisteDifficultyVisibility(refs: MapLayerRefs, difficulty: PisteDifficulty, enabled: boolean): void {
  if (refs.pisteLinesByDiff) refs.pisteLinesByDiff[difficulty].alpha = enabled ? 1 : HIDDEN_LAYER_ALPHA;
  if (refs.pisteMarkersByDiff) refs.pisteMarkersByDiff[difficulty].visible = enabled;
}

export function applyPisteVisibility(
  refs: MapLayerRefs,
  visible: boolean,
  filter: Record<PisteDifficulty, boolean>,
): void {
  if (refs.pisteOverlay) refs.pisteOverlay.alpha = visible ? 1 : HIDDEN_LAYER_ALPHA;
  if (refs.pisteMarkerOverlay) refs.pisteMarkerOverlay.visible = visible;

  for (const diff of DIFFICULTIES) {
    if (refs.pisteLinesByDiff) refs.pisteLinesByDiff[diff].alpha = visible ? (filter[diff] ? 1 : HIDDEN_LAYER_ALPHA) : 1;
    if (refs.pisteMarkersByDiff) refs.pisteMarkersByDiff[diff].visible = visible && filter[diff];
  }
}

export function applyPoiLayerVisibility(container: Container | null, visible: boolean): void {
  if (container) container.alpha = visible ? 1 : HIDDEN_LAYER_ALPHA;
}

export function redrawStatusLayers({ refs, overlayData, visualScale = 1 }: {
  refs: MapLayerRefs;
  overlayData: ResortOverlayData;
  visualScale?: number;
}): void {
  if (refs.liftOverlay) {
    refs.liftOverlay.removeChildren();
    drawLiftOverlay(refs.liftOverlay, overlayData.lifts, visualScale);
  }
  if (refs.liftMarkerOverlay) {
    refs.liftMarkerOverlay.removeChildren();
    drawLiftMarkerOverlay(refs.liftMarkerOverlay, overlayData.lifts, visualScale);
  }

  if (refs.pisteLinesByDiff && refs.pisteMarkersByDiff) {
    for (const diff of DIFFICULTIES) {
      const filtered = overlayData.pistes.filter((piste) => piste.difficulty === diff);
      const lineSub = refs.pisteLinesByDiff[diff];
      lineSub.removeChildren();
      drawPisteOverlay(lineSub, filtered, visualScale);

      const markerSub = refs.pisteMarkersByDiff[diff];
      markerSub.removeChildren();
      drawPisteMarkerOverlay(markerSub, filtered, visualScale);
    }
  }
}
