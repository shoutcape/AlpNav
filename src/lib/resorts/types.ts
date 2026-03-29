import type { PanoramaManifest } from "@/features/map/types";
import type { ResortOverlayData } from "@/lib/domain/types";

export type ResortAvailability = "available" | "coming-soon";

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
};
