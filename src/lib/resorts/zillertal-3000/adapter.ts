import type { ResortOverlayData } from "@/lib/domain/types";
import { loadIntermapsOverlayData } from "../intermaps/parser";

let cachedResult: Promise<ResortOverlayData> | null = null;

export function loadZillertal3000OverlayData(): Promise<ResortOverlayData> {
  if (cachedResult === null) {
    cachedResult = loadIntermapsOverlayData("ski-gletscherwelt-zillertal-3000");
  }

  return cachedResult;
}
