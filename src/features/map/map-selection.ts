import { Graphics } from "pixi.js";
import type { GastronomySpot, InfrastructurePoi, Lift, Piste, SportFunPoi, Webcam } from "@/lib/domain/types";
import { drawBadgeHighlight, drawLiftHighlight, drawPisteHighlight } from "./overlays/drawHighlightOverlay";
import type { SelectedMapItem } from "./map-shell-types";

type BadgeHighlightItem = Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi;

export type SelectedHighlightTargets = {
  piste: Piste | null;
  lift: Lift | null;
  badge: BadgeHighlightItem | null;
};

export function isPiste(item: SelectedMapItem | null): item is Piste {
  return item !== null && "difficulty" in item;
}

export function isLift(item: SelectedMapItem | null): item is Lift {
  return item !== null && "liftType" in item;
}

export function isPointOfInterest(item: SelectedMapItem | null): item is GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi {
  return item !== null && "position" in item;
}

export function getSelectedHighlightTargets(item: SelectedMapItem | null): SelectedHighlightTargets {
  if (isPiste(item)) {
    return { piste: item, lift: null, badge: item };
  }

  if (isLift(item)) {
    return { piste: null, lift: item, badge: item };
  }

  if (isPointOfInterest(item)) {
    return { piste: null, lift: null, badge: item };
  }

  return { piste: null, lift: null, badge: null };
}

export function drawSelectedItemHighlights({
  pisteHighlight,
  liftHighlight,
  badgeHighlight,
  selectedItem,
  visualScale,
}: {
  pisteHighlight: Graphics;
  liftHighlight: Graphics;
  badgeHighlight: Graphics | null;
  selectedItem: SelectedMapItem | null;
  visualScale?: number;
}): void {
  const targets = getSelectedHighlightTargets(selectedItem);

  drawPisteHighlight(pisteHighlight, targets.piste, visualScale);
  drawLiftHighlight(liftHighlight, targets.lift, visualScale);
  if (badgeHighlight) drawBadgeHighlight(badgeHighlight, targets.badge, visualScale);
}
