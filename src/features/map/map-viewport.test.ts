import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import { applyLevelBlend, clamp, computeMinScale, getDominantLevel } from "./map-viewport";
import type { PanoramaLevel } from "./types";

const levels: PanoramaLevel[] = [
  { localIndex: 0, remoteZoom: 1, width: 500, height: 250, columns: 2, rows: 1 },
  { localIndex: 1, remoteZoom: 2, width: 1000, height: 500, columns: 4, rows: 2 },
  { localIndex: 2, remoteZoom: 3, width: 2000, height: 1000, columns: 8, rows: 4 },
];

function makeContainers() {
  return new Map(levels.map((level) => [level.remoteZoom, new Container()]));
}

function hideContainers(containers: Map<number, Container>) {
  for (const container of containers.values()) {
    container.visible = false;
    container.alpha = 0;
  }
}

describe("clamp", () => {
  it("returns the minimum when the value is below range", () => {
    expect(clamp(-1, 0, 3)).toBe(0);
  });

  it("returns the value when it is inside range", () => {
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("returns the maximum when the value is above range", () => {
    expect(clamp(4, 0, 3)).toBe(3);
  });
});

describe("computeMinScale", () => {
  it("fits the world by the smaller screen axis with padding", () => {
    expect(computeMinScale(390, 844, 2000, 1000)).toBeCloseTo(0.1794);
  });
});

describe("applyLevelBlend", () => {
  it("keeps the base loaded level visible as a fallback", () => {
    const containers = makeContainers();
    applyLevelBlend(levels, containers, new Set([1]), 100);

    expect(containers.get(1)?.visible).toBe(true);
    expect(containers.get(1)?.alpha).toBe(1);
    expect(containers.get(2)?.visible).toBe(false);
  });

  it("fades the upper loaded level in during its transition range", () => {
    const containers = makeContainers();
    applyLevelBlend(levels, containers, new Set([1, 2]), 437.5);

    expect(containers.get(1)?.visible).toBe(true);
    expect(containers.get(1)?.alpha).toBe(1);
    expect(containers.get(2)?.visible).toBe(true);
    expect(containers.get(2)?.alpha).toBe(0.5);
  });

  it("shows the highest loaded level after the final transition", () => {
    const containers = makeContainers();
    applyLevelBlend(levels, containers, new Set([1, 2, 3]), 2500);

    expect(containers.get(3)?.visible).toBe(true);
    expect(containers.get(3)?.alpha).toBe(1);
  });
});

describe("getDominantLevel", () => {
  it("returns null when no visible level containers exist", () => {
    const containers = makeContainers();
    hideContainers(containers);

    expect(getDominantLevel(levels, containers)).toBeNull();
  });

  it("chooses the highest alpha visible level", () => {
    const containers = makeContainers();
    hideContainers(containers);
    containers.get(1)!.visible = true;
    containers.get(1)!.alpha = 1;
    containers.get(2)!.visible = true;
    containers.get(2)!.alpha = 0.5;

    expect(getDominantLevel(levels, containers)).toEqual({ level: levels[0], alpha: 1 });
  });

  it("chooses the higher zoom level when visible levels have equal alpha", () => {
    const containers = makeContainers();
    hideContainers(containers);
    containers.get(1)!.visible = true;
    containers.get(1)!.alpha = 1;
    containers.get(2)!.visible = true;
    containers.get(2)!.alpha = 1;

    expect(getDominantLevel(levels, containers)).toEqual({ level: levels[1], alpha: 1 });
  });
});
