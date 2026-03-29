import type { GeoPoint } from "@/lib/domain/types";

export type OsmWayPiste = {
  osmId: string;
  type: "way";
  ref: string | null;
  name: string | null;
  difficulty: string | null;
  geoPoints: GeoPoint[];
};

export type OsmRelationPiste = {
  osmId: string;
  type: "relation";
  ref: string | null;
  name: string | null;
  difficulty: string | null;
  ways: { role: string; geoPoints: GeoPoint[] }[];
};

export type OsmPiste = OsmWayPiste | OsmRelationPiste;

/** Extract the route number from an OSM piste (checks ref, then name) */
export function getOsmRouteNumber(piste: OsmPiste): string | null {
  if (piste.ref) return piste.ref;
  // Many pistes use name as the route number (e.g. name="32")
  if (piste.name && /^\d+[a-z]?$/.test(piste.name)) return piste.name;
  return null;
}
