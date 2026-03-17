import { MapShell } from "@/features/map/MapShell";
import panoramaManifest from "../../public/resorts/zillertal-arena/panorama/manifest.json";

export default function Home() {
  return <MapShell manifest={panoramaManifest} />;
}
