export type Point = { x: number; y: number };
export type PisteDifficulty = "easy" | "medium" | "difficult" | "unknown";
export type LiftType = "gondola" | "chairlift" | "drag" | "other";

export type Piste = {
  id: string;
  name: string;
  difficulty: PisteDifficulty;
  segments: Point[][];
};

export type Lift = {
  id: string;
  name: string;
  liftType: LiftType;
  segments: Point[][];
};

export type MapLabel = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: number;
  fontWeight: "bold" | "normal";
  tier: 1 | 2 | 3 | 4;
  bgColor?: number;
  bgX?: number;
  bgY?: number;
  bgW?: number;
  bgH?: number;
};

export type ResortOverlayData = { pistes: Piste[]; lifts: Lift[]; labels: MapLabel[] };
