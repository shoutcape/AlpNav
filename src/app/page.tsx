import { MapShell } from "@/features/map/MapShell";
import { DEFAULT_RESORT_ID } from "@/lib/resorts/catalog";

export default function Home() {
  return <MapShell initialAreaId={DEFAULT_RESORT_ID} />;
}
