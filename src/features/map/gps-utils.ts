import type { AnchorPoint } from "./map-shell-types";

const EARTH_RADIUS_M = 6371000;
const DEFAULT_HYSTERESIS_M = 30;

export type GeoPosition = {
  lat: number;
  lng: number;
};

export type AnchorMatch = {
  anchor: AnchorPoint;
  distance: number;
};

export function distanceMeters(a: GeoPosition, b: GeoPosition) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function findNearestAnchor(position: GeoPosition, anchors: AnchorPoint[]): AnchorMatch | null {
  let best: AnchorMatch | null = null;

  for (const anchor of anchors) {
    const distance = distanceMeters(position, anchor.geo);

    if (distance <= anchor.snapRadius && (!best || distance < best.distance)) {
      best = { anchor, distance };
    }
  }

  return best;
}

export function resolveGpsAnchorMatch(
  position: GeoPosition,
  anchors: AnchorPoint[],
  previousAnchorId: string | null,
  hysteresisMeters = DEFAULT_HYSTERESIS_M,
): AnchorMatch | null {
  let best = findNearestAnchor(position, anchors);

  if (!previousAnchorId || !best) {
    return best;
  }

  const previous = anchors.find((anchor) => anchor.id === previousAnchorId);

  if (!previous || best.anchor.id === previous.id) {
    return best;
  }

  const previousDistance = distanceMeters(position, previous.geo);

  if (previousDistance <= previous.snapRadius && best.distance > previousDistance - hysteresisMeters) {
    best = { anchor: previous, distance: previousDistance };
  }

  return best;
}
