import type { ResortOverlayData } from "@/lib/domain/types";
import { loadIntermapsOverlayData } from "../intermaps/parser";

let cachedResult: Promise<ResortOverlayData> | null = null;

export function loadHintertuxerGletscherOverlayData(): Promise<ResortOverlayData> {
  if (cachedResult === null) {
    cachedResult = loadIntermapsOverlayData("hintertuxer-gletscher");
  }

  return cachedResult;
}
