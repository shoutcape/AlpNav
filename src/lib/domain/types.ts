export type Point = { x: number; y: number };
export type PisteDifficulty = "easy" | "medium" | "difficult" | "unknown";
export type LiftType = "gondola" | "chairlift" | "drag" | "other";

export type Piste = {
  id: string;
  name: string;
  difficulty: PisteDifficulty;
  segments: Point[][];             // solid slope segments
  skiRouteSegments?: Point[][];    // dashed ski route segments
  number?: string;
  icons?: Point[];
  lengthM?: number;
  status?: "open" | "closed";
};

export type Lift = {
  id: string;
  name: string;
  liftType: LiftType;
  segments: Point[][];
  icon?: Point;
  altitudeValley?: number;
  altitudeMountain?: number;
  status?: "open" | "closed";
  capacity?: number;
  subtitle?: string;
  imageUrls?: string[];
  description?: string;
  openingHours?: string;
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

export type GastronomyType = "restaurant" | "bar" | "cafe";

export type GastronomySpot = {
  id: string;
  name: string;
  type: GastronomyType;
  position: Point;
  description?: string;
  imageUrls?: string[];
  openingHours?: string;
};

export type InfrastructureCategory = "parking" | "bus" | "info" | "rescue";

export type InfrastructurePoi = {
  id: string;
  name: string;
  category: InfrastructureCategory;
  position: Point;
  description?: string;
};

export type WebcamProvider = "feratel" | "panomax";

export type Webcam = {
  id: string;
  name: string;
  provider: WebcamProvider;
  position: Point;
  thumbnailUrl?: string;
  streamUrl: string;
};

export type ResortOverlayData = { pistes: Piste[]; lifts: Lift[]; labels: MapLabel[]; gastronomy: GastronomySpot[]; webcams: Webcam[]; infrastructure: InfrastructurePoi[] };
