import type { PanoramaManifest } from "@/features/map/types";
import type { ResortOverlayData } from "@/lib/domain/types";

export type ResortAvailability = "available" | "coming-soon";

/** south, west, north, east — WGS 84 degrees */
export type BBox = { south: number; west: number; north: number; east: number };

export type ResortDefinition = {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  availability: ResortAvailability;
  locationLabel: string;
  elevationLabel: string;
  conditionsUrl: string;
  manifest: PanoramaManifest;
  visualScale?: number;
  labelTierScales?: readonly [number, number, number, number];
  loadOverlayData: () => Promise<ResortOverlayData>;
  bbox?: BBox;
};
