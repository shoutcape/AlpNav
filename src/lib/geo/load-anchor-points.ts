import type { AnchorPoint } from "@/lib/domain/types";

const cache = new Map<string, Promise<AnchorPoint[]>>();

export function loadAnchorPoints(resortId: string): Promise<AnchorPoint[]> {
  if (!cache.has(resortId)) {
    cache.set(
      resortId,
      fetch(`/resorts/${resortId}/overlays/anchor-points.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load anchor points: ${r.status}`);
          return r.json();
        })
        .catch((err) => {
          cache.delete(resortId);
          throw err;
        }),
    );
  }
  return cache.get(resortId)!;
}
