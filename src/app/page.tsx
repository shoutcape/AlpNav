"use client";

import dynamic from "next/dynamic";
import { DEFAULT_RESORT_ID } from "@/lib/resorts/catalog";

const MapShell = dynamic(
  () => import("@/features/map/MapShell").then((m) => ({ default: m.MapShell })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-ivory/20 border-t-ivory/70" />
      </div>
    ),
  },
);

export default function Home() {
  return <MapShell initialAreaId={DEFAULT_RESORT_ID} />;
}
