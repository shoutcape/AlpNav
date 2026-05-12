import { describe, expect, it } from "vitest";
import type { GastronomySpot, InfrastructurePoi, Lift, Piste, SportFunPoi, Webcam } from "@/lib/domain/types";
import { getSelectedHighlightTargets } from "./map-selection";

const piste: Piste = {
  id: "p1",
  name: "Blue 1",
  difficulty: "easy",
  segments: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]],
};

const lift: Lift = {
  id: "l1",
  name: "Lift 1",
  liftType: "gondola",
  segments: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]],
};

const gastronomy: GastronomySpot = {
  id: "g1",
  name: "Food 1",
  type: "restaurant",
  position: { x: 0, y: 0 },
};

const webcam: Webcam = {
  id: "w1",
  name: "Cam 1",
  provider: "feratel",
  position: { x: 0, y: 0 },
  streamUrl: "https://example.com/live",
};

const infrastructure: InfrastructurePoi = {
  id: "i1",
  name: "Parking 1",
  category: "parking",
  position: { x: 0, y: 0 },
};

const sportFun: SportFunPoi = {
  id: "s1",
  name: "Speed Check",
  sportCategory: "speedcheck",
  position: { x: 0, y: 0 },
};

describe("getSelectedHighlightTargets", () => {
  it("routes piste selections to piste and badge highlights", () => {
    expect(getSelectedHighlightTargets(piste)).toEqual({
      piste,
      lift: null,
      badge: piste,
    });
  });

  it("routes lift selections to lift and badge highlights", () => {
    expect(getSelectedHighlightTargets(lift)).toEqual({
      piste: null,
      lift,
      badge: lift,
    });
  });

  it("routes point selections to badge highlights only", () => {
    expect(getSelectedHighlightTargets(gastronomy)).toEqual({ piste: null, lift: null, badge: gastronomy });
    expect(getSelectedHighlightTargets(webcam)).toEqual({ piste: null, lift: null, badge: webcam });
    expect(getSelectedHighlightTargets(infrastructure)).toEqual({ piste: null, lift: null, badge: infrastructure });
    expect(getSelectedHighlightTargets(sportFun)).toEqual({ piste: null, lift: null, badge: sportFun });
  });

  it("clears all highlight targets when nothing is selected", () => {
    expect(getSelectedHighlightTargets(null)).toEqual({
      piste: null,
      lift: null,
      badge: null,
    });
  });
});
