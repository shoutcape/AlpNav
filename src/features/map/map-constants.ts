import type { PisteDifficulty } from "@/lib/domain/types";

// Minimum viewport scale at which each tier becomes visible.
// Scale 0.09 ~= fully zoomed out on a 390px screen; ~2 ~= fully zoomed in.
export const LABEL_TIER_SCALES = [0, 0.25, 0.50, 0.85] as const;

export const DIFFICULTIES: PisteDifficulty[] = ["easy", "medium", "difficult", "unknown"];

export const DEFAULT_PISTE_FILTER: Record<PisteDifficulty, boolean> = {
  easy: true,
  medium: true,
  difficult: true,
  unknown: true,
};

export const DIFFICULTY_LABELS: Record<PisteDifficulty, string> = {
  easy: "Easy",
  medium: "Med",
  difficult: "Hard",
  unknown: "Other",
};

export const DIFFICULTY_CSS_COLORS: Record<PisteDifficulty, string> = {
  easy: "#0069ea",
  medium: "#ff0000",
  difficult: "#444444",
  unknown: "#9e9e9e",
};
