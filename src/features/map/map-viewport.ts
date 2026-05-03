import type { Container } from "pixi.js";
import type { PanoramaLevel } from "./types";

export function applyLevelBlend(
  levels: PanoramaLevel[],
  containers: Map<number, Container>,
  loadedLevels: Set<number>,
  projectedWidth: number,
) {
  const available = levels.filter((level) => loadedLevels.has(level.remoteZoom));

  if (available.length === 0) {
    return;
  }

  // Reset all containers, but always keep the base (lowest) level visible
  // so it acts as a backdrop while higher-res tiles are still loading.
  const baseZoom = available[0].remoteZoom;
  for (const level of levels) {
    const container = containers.get(level.remoteZoom);
    if (!container) continue;

    if (level.remoteZoom === baseZoom) {
      container.alpha = 1;
      container.visible = true;
    } else {
      container.alpha = 0;
      container.visible = false;
    }
  }

  if (available.length === 1) {
    return;
  }

  for (let index = 0; index < available.length - 1; index += 1) {
    const lower = available[index];
    const upper = available[index + 1];
    const fadeStart = lower.width * 0.75;
    const fadeEnd = lower.width;

    if (projectedWidth <= fadeStart) {
      const lowerContainer = containers.get(lower.remoteZoom);

      if (lowerContainer) {
        lowerContainer.alpha = 1;
        lowerContainer.visible = true;
      }

      return;
    }

    if (projectedWidth <= fadeEnd) {
      const mix = clamp((projectedWidth - fadeStart) / Math.max(fadeEnd - fadeStart, 1), 0, 1);
      const lowerContainer = containers.get(lower.remoteZoom);
      const upperContainer = containers.get(upper.remoteZoom);

      // Keep lower at full alpha so the background never bleeds through.
      // Upper fades in on top; once fully opaque it covers the lower entirely.
      if (lowerContainer) {
        lowerContainer.alpha = 1;
        lowerContainer.visible = true;
      }

      if (upperContainer) {
        upperContainer.alpha = mix;
        upperContainer.visible = mix > 0;
      }

      return;
    }
  }

  const last = containers.get(available[available.length - 1].remoteZoom);

  if (last) {
    last.alpha = 1;
    last.visible = true;
  }
}

export function computeMinScale(screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number) {
  return Math.min(screenWidth / worldWidth, screenHeight / worldHeight) * 0.92;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getDominantLevel(levels: PanoramaLevel[], containers: Map<number, Container>) {
  let dominant: { level: PanoramaLevel; alpha: number } | null = null;

  for (const level of levels) {
    const container = containers.get(level.remoteZoom);

    if (!container?.visible) {
      continue;
    }

    if (!dominant || container.alpha >= dominant.alpha) {
      dominant = { level, alpha: container.alpha };
    }
  }

  return dominant;
}
