"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/domain/types";

export type GeoFix = {
  position: GeoPoint;
  accuracy: number; // meters
  altitude: number | null;
  heading: number | null;
  speed: number | null; // m/s
  timestamp: number;
};

export type GeoStatus = "idle" | "requesting" | "active" | "denied" | "unavailable" | "error";

/**
 * React hook that streams GPS fixes via the Geolocation API.
 * Only active when `enabled` is true.
 */
export function useGeolocation(enabled: boolean): {
  fix: GeoFix | null;
  status: GeoStatus;
} {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus("idle");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }

    setStatus("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("active");
        setFix({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            break;
          default:
            setStatus("error");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { fix, status };
}
