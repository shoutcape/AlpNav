import arenaManifest from "../../../public/resorts/zillertal-arena/panorama/manifest.json";
import hochzillertalManifest from "../../../public/resorts/hochzillertal-hochfugen-spieljoch/panorama/manifest.json";
import mayrhofenManifest from "../../../public/resorts/mayrhofner-bergbahnen/panorama/manifest.json";
import hintertuxerGletscherManifest from "../../../public/resorts/hintertuxer-gletscher/panorama/manifest.json";
import { loadArenaOverlayData } from "@/lib/resorts/arena/adapter";
import { loadHochzillertalOverlayData } from "@/lib/resorts/hochzillertal/adapter";
import { loadMayrhofenOverlayData } from "@/lib/resorts/mayrhofen/adapter";
import { loadHintertuxerGletscherOverlayData } from "@/lib/resorts/hintertuxer-gletscher/adapter";
import type { ResortDefinition } from "@/lib/resorts/types";

export const DEFAULT_RESORT_ID = "zillertal-arena";

export const RESORTS: ResortDefinition[] = [
  {
    id: "zillertal-arena",
    name: "Zillertal Arena",
    shortName: "Arena",
    subtitle: "Available now",
    availability: "available",
    locationLabel: "Zell am Ziller, Austria",
    elevationLabel: "580 - 2,500 m",
    conditionsUrl: "https://www.bergfex.com/zell-am-ziller/wetter/",
    manifest: arenaManifest,
    visualScale: 1.0,
    labelTierScales: [0, 0.1, 0.2, 0.7],
    loadOverlayData: loadArenaOverlayData,
    bbox: { south: 47.10, west: 11.87, north: 47.35, east: 12.25 },
  },
  {
    id: "mayrhofner-bergbahnen",
    name: "Mayrhofner Bergbahnen",
    shortName: "Mayrhofen",
    subtitle: "Available now",
    availability: "available",
    locationLabel: "Mayrhofen, Austria",
    elevationLabel: "630 - 2,500 m",
    conditionsUrl: "https://www.bergfex.com/mayrhofen/wetter/",
    manifest: mayrhofenManifest,
    visualScale: 2.0,
    labelTierScales: [0, 0.1, 0.0, 0.0],
    loadOverlayData: loadMayrhofenOverlayData,
    bbox: { south: 47.12, west: 11.82, north: 47.20, east: 11.90 },
  },
  {
    id: "hintertuxer-gletscher",
    name: "Hintertuxer Gletscher",
    shortName: "Hintertux",
    subtitle: "Available now",
    availability: "available",
    locationLabel: "Tux, Austria",
    elevationLabel: "1,500 - 3,250 m",
    conditionsUrl: "https://www.bergfex.com/hintertuxer-gletscher/wetter/",
    manifest: hintertuxerGletscherManifest,
    visualScale: 2.0,
    labelTierScales: [0, 0.1, 0.0, 0.0],
    loadOverlayData: loadHintertuxerGletscherOverlayData,
    bbox: { south: 47.02, west: 11.62, north: 47.10, east: 11.72 },
  },
  {
    id: "hochzillertal-hochfugen-spieljoch",
    name: "Hochzillertal-Hochfugen-Spieljoch",
    shortName: "Hochzillertal",
    subtitle: "Available now",
    availability: "available",
    locationLabel: "Fugen-Kaltenbach, Austria",
    elevationLabel: "600 - 2,500 m",
    conditionsUrl: "https://www.bergfex.com/hochzillertal-hochfuegen/wetter/",
    manifest: hochzillertalManifest,
    visualScale: 2.0,
    labelTierScales: [0, 0.1, 0.4, 0.0],
    loadOverlayData: loadHochzillertalOverlayData,
    bbox: { south: 47.15, west: 11.80, north: 47.30, east: 11.95 },
  },
];

const defaultResort = (() => {
  const resort = RESORTS.find((entry) => entry.id === DEFAULT_RESORT_ID);

  if (!resort) {
    throw new Error(`Default resort not found for id: ${DEFAULT_RESORT_ID}`);
  }

  return resort;
})();

export function getResortById(id: string): ResortDefinition | undefined {
  return RESORTS.find((resort) => resort.id === id);
}

export function resolveActiveResort(id: string): ResortDefinition {
  const match = getResortById(id);
  return match?.availability === "available" ? match : defaultResort;
}

export function canActivateResort(id: string): boolean {
  return getResortById(id)?.availability === "available";
}
