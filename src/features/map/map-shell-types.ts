import type { GastronomySpot, InfrastructurePoi, Lift, Piste, SportFunPoi, Webcam } from "@/lib/domain/types";

export type DebugStats = {
  scale: number;
  activeLevel: number;
  blendPct: number;
  worldCenterX: number;
  worldCenterY: number;
  loadedCount: number;
  totalCount: number;
};

export type AnchorPoint = {
  id: string;
  name: string;
  type: string;
  geo: { lat: number; lng: number };
  panorama: { x: number; y: number };
  snapRadius: number;
};

export type DebugAnchorPoint = Omit<AnchorPoint, "snapRadius">;

export type GpsPosition = {
  lat: number;
  lng: number;
  dist: number | null;
};

export type GpsStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

export type SelectedMapItem = Piste | Lift | GastronomySpot | Webcam | InfrastructurePoi | SportFunPoi;
