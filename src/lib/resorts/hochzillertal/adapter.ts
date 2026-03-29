import type { ResortOverlayData } from "@/lib/domain/types";
import { loadIntermapsOverlayData } from "../intermaps/parser";

let cachedResult: Promise<ResortOverlayData> | null = null;

export function loadHochzillertalOverlayData(): Promise<ResortOverlayData> {
  if (cachedResult === null) {
    cachedResult = loadIntermapsOverlayData("hochzillertal-hochfugen-spieljoch");
  }

  return cachedResult;
}
