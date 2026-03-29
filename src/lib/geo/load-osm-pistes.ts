import type { OsmPiste } from "./osm-types";

const cache = new Map<string, Promise<OsmPiste[]>>();

export function loadOsmPistes(resortId: string): Promise<OsmPiste[]> {
  if (!cache.has(resortId)) {
    cache.set(
      resortId,
      fetch(`/resorts/${resortId}/overlays/osm-pistes.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`Failed to load OSM pistes: ${r.status}`);
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
