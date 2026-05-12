"use client";

import { motion } from "motion/react";
import type { AnchorPoint, GpsStatus } from "./map-shell-types";

type GpsLocationButtonProps = {
  gpsActive: boolean;
  gpsStatus: GpsStatus;
  gpsMatch: AnchorPoint | null;
  onClickAction: () => void;
};

export function GpsLocationButton({ gpsActive, gpsStatus, gpsMatch, onClickAction }: GpsLocationButtonProps) {
  return (
    <button
      onClick={onClickAction}
      className={`pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/[0.09] shadow-[0_2px_12px_rgba(0,0,0,0.45)] backdrop-blur-md active:scale-95 ${
        gpsStatus === "denied" || gpsStatus === "unavailable"
          ? "bg-red-500/80 text-white"
          : gpsActive && gpsMatch
            ? "bg-blue-500/90 text-white"
            : gpsActive
              ? "text-white"
              : "bg-[#07111f]/65 text-white/70"
      }`}
      aria-label="Toggle GPS location"
    >
      {gpsActive && gpsMatch && (
        <motion.div
          className="absolute inset-0 rounded-[13px] border-2 border-blue-400/50"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {gpsActive && !gpsMatch && (
        <motion.div
          className="absolute inset-0 -z-10 rounded-[13px] bg-blue-500/90"
          animate={{ opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="1" fill="currentColor" />
        <line x1="8" y1="0.5" x2="8" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="13" x2="8" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0.5" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="13" y1="8" x2="15.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
