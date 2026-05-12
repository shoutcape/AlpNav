import type { ChangeEvent, PointerEvent, RefObject } from "react";
import type { AnchorPoint, DebugAnchorPoint, DebugStats, GpsPosition, GpsStatus } from "./map-shell-types";

type MapDebugPanelProps = {
  debugMode: "normal";
  debugStats: DebugStats | null;
  debugPanelPos: { x: number; y: number };
  debugAnchors: DebugAnchorPoint[];
  debugSelectedAnchor: string;
  gpsStatus: GpsStatus;
  gpsPos: GpsPosition | null;
  gpsMatch: AnchorPoint | null;
  activeAreaId: string;
  maxScale: number;
  minScale: number;
  panelRef: RefObject<HTMLDivElement | null>;
  onSetDebugMode: (mode: "normal") => void;
  onZoomSliderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelectDebugAnchor: (anchorId: string) => void;
  onDebugPanelPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onDebugPanelPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onDebugPanelPointerUp: () => void;
};

export function MapDebugPanel({
  debugMode,
  debugStats,
  debugPanelPos,
  debugAnchors,
  debugSelectedAnchor,
  gpsStatus,
  gpsPos,
  gpsMatch,
  activeAreaId,
  maxScale,
  minScale,
  panelRef,
  onSetDebugMode,
  onZoomSliderChange,
  onSelectDebugAnchor,
  onDebugPanelPointerDown,
  onDebugPanelPointerMove,
  onDebugPanelPointerUp,
}: MapDebugPanelProps) {
  return (
    <div
      ref={panelRef}
      className="absolute z-50 rounded bg-black/70 p-2 font-mono text-xs text-white space-y-1.5 w-64 pointer-events-auto"
      style={debugPanelPos.y === -1
        ? { left: debugPanelPos.x, bottom: 16 }
        : { left: debugPanelPos.x, top: debugPanelPos.y }
      }
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-white/20 pb-1.5 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onDebugPanelPointerDown}
        onPointerMove={onDebugPanelPointerMove}
        onPointerUp={onDebugPanelPointerUp}
      >
        <span className="text-[9px] uppercase tracking-widest text-white/50">Debug</span>
        <div className="flex gap-1">
          <button
            onClick={() => onSetDebugMode("normal")}
            className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest transition-colors ${debugMode === "normal" ? "bg-yellow-400/90 text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            aria-label="Show normal debug mode"
          >
            normal
          </button>
        </div>
      </div>

      {debugStats && (
        <>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={(() => {
              const logMin = Math.log(minScale);
              const logMax = Math.log(maxScale);
              return ((Math.log(debugStats.scale) - logMin) / (logMax - logMin)).toFixed(4);
            })()}
            onChange={onZoomSliderChange}
            className="w-full accent-yellow-400"
            aria-label="Zoom"
          />
          <div className="space-y-0.5 pointer-events-none">
            <div>scale: {debugStats.scale.toFixed(4)}</div>
            <div>level: z{debugStats.activeLevel} ({debugStats.blendPct.toFixed(0)}%)</div>
            <div>center: {debugStats.worldCenterX}, {debugStats.worldCenterY}</div>
            <div>loaded: {debugStats.loadedCount}/{debugStats.totalCount}</div>
          </div>
        </>
      )}

      <div className="border-t border-white/10 pt-1.5 space-y-0.5">
        <div className="text-[9px] uppercase tracking-widest text-white/40">GPS</div>
        <div className="text-[10px] text-white/70">status: {gpsStatus}</div>
        {gpsPos && (
          <>
            <div className="text-[10px] text-white/70">pos: {gpsPos.lat.toFixed(6)}, {gpsPos.lng.toFixed(6)}</div>
            <div className="text-[10px] text-white/70">
              match: {gpsMatch ? `${gpsMatch.name} (${gpsPos.dist?.toFixed(0)}m)` : "none"}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-white/10 pt-1.5 space-y-1">
        <div className="text-[9px] uppercase tracking-widest text-white/40">Anchor Test ({debugAnchors.length})</div>
        {debugAnchors.length === 0 ? (
          <div className="text-[10px] text-white/30">no anchor-points.json for {activeAreaId}</div>
        ) : (
          <></>
        )}
        {debugAnchors.length > 0 && (
          <>
            <select
              value={debugSelectedAnchor}
              onChange={(event) => onSelectDebugAnchor(event.target.value)}
              className="w-full rounded bg-white/10 px-1.5 py-1 text-[10px] text-white outline-none focus:bg-white/15"
            >
              <option value="" className="bg-[#111]">select anchor...</option>
              {debugAnchors.map((anchor) => (
                <option key={anchor.id} value={anchor.id} className="bg-[#111]">[{anchor.type}] {anchor.name}</option>
              ))}
            </select>
            {(() => {
              const anchor = debugAnchors.find((entry) => entry.id === debugSelectedAnchor);
              if (!anchor) return null;
              return (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-white/70">{anchor.geo.lat.toFixed(6)}, {anchor.geo.lng.toFixed(6)}</div>
                  <a
                    href={`https://www.openstreetmap.org/#map=19/${anchor.geo.lat}/${anchor.geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                  >
                    view on OSM
                  </a>
                  <div className="text-[10px] text-white/40">pano: {anchor.panorama.x.toFixed(0)}, {anchor.panorama.y.toFixed(0)}</div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
