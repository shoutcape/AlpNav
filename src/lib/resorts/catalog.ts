import arenaManifest from "../../../public/resorts/zillertal-arena/panorama/manifest.json";
import { loadArenaOverlayData } from "@/lib/resorts/arena/adapter";
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
    loadOverlayData: loadArenaOverlayData,
  },
  {
    id: "mayrhofner-bergbahnen",
    name: "Mayrhofner Bergbahnen",
    shortName: "Mayrhofen",
    subtitle: "Coming soon",
    availability: "coming-soon",
    locationLabel: "Mayrhofen, Austria",
    elevationLabel: "630 - 2,500 m",
    conditionsUrl: "https://www.bergfex.com/mayrhofen/wetter/",
    manifest: arenaManifest,
    loadOverlayData: loadArenaOverlayData,
  },
  {
    id: "ski-gletscherwelt-zillertal-3000",
    name: "Ski & Gletscherwelt Zillertal 3000",
    shortName: "Zillertal 3000",
    subtitle: "Coming soon",
    availability: "coming-soon",
    locationLabel: "Tux-Finkenberg, Austria",
    elevationLabel: "630 - 3,250 m",
    conditionsUrl: "https://www.bergfex.com/hintertuxer-gletscher/wetter/",
    manifest: arenaManifest,
    loadOverlayData: loadArenaOverlayData,
  },
  {
    id: "hochzillertal-hochfugen-spieljoch",
    name: "Hochzillertal-Hochfugen-Spieljoch",
    shortName: "Hochzillertal",
    subtitle: "Coming soon",
    availability: "coming-soon",
    locationLabel: "Kaltenbach-Fugen, Austria",
    elevationLabel: "600 - 2,500 m",
    conditionsUrl: "https://www.bergfex.com/hochzillertal-hochfuegen/wetter/",
    manifest: arenaManifest,
    loadOverlayData: loadArenaOverlayData,
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
