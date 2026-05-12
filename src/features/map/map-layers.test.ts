import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import type { PisteDifficulty } from "@/lib/domain/types";
import {
  HIDDEN_LAYER_ALPHA,
  applyLiftVisibility,
  applyPisteDifficultyVisibility,
  applyPisteVisibility,
  applyPoiLayerVisibility,
  createEmptyMapLayerRefs,
} from "./map-layers";

function difficultyContainers() {
  return {
    easy: new Container(),
    medium: new Container(),
    difficult: new Container(),
    unknown: new Container(),
  } satisfies Record<PisteDifficulty, Container>;
}

describe("createEmptyMapLayerRefs", () => {
  it("initializes every map layer ref to null", () => {
    expect(createEmptyMapLayerRefs()).toEqual({
      pisteOverlay: null,
      liftOverlay: null,
      liftMarkerOverlay: null,
      pisteMarkerOverlay: null,
      pisteHighlight: null,
      liftHighlight: null,
      badgeHighlight: null,
      gastronomyOverlay: null,
      webcamOverlay: null,
      infrastructureOverlay: null,
      sportFunOverlay: null,
      gpsDot: null,
      debugDot: null,
      debugLayer: null,
      pisteLinesByDiff: null,
      pisteMarkersByDiff: null,
    });
  });
});

describe("applyLiftVisibility", () => {
  it("dims lift lines and hides lift markers when disabled", () => {
    const refs = createEmptyMapLayerRefs();
    refs.liftOverlay = new Container();
    refs.liftMarkerOverlay = new Container();

    applyLiftVisibility(refs, false);

    expect(refs.liftOverlay.alpha).toBe(HIDDEN_LAYER_ALPHA);
    expect(refs.liftMarkerOverlay.visible).toBe(false);
  });
});

describe("applyPisteDifficultyVisibility", () => {
  it("dims only the selected difficulty line and hides its markers", () => {
    const refs = createEmptyMapLayerRefs();
    refs.pisteLinesByDiff = difficultyContainers();
    refs.pisteMarkersByDiff = difficultyContainers();

    applyPisteDifficultyVisibility(refs, "medium", false);

    expect(refs.pisteLinesByDiff.medium.alpha).toBe(HIDDEN_LAYER_ALPHA);
    expect(refs.pisteMarkersByDiff.medium.visible).toBe(false);
    expect(refs.pisteLinesByDiff.easy.alpha).toBe(1);
    expect(refs.pisteMarkersByDiff.easy.visible).toBe(true);
  });
});

describe("applyPisteVisibility", () => {
  it("dims the parent piste layer and hides parent markers when disabled", () => {
    const refs = createEmptyMapLayerRefs();
    refs.pisteOverlay = new Container();
    refs.pisteMarkerOverlay = new Container();
    refs.pisteLinesByDiff = difficultyContainers();
    refs.pisteMarkersByDiff = difficultyContainers();

    applyPisteVisibility(refs, false, {
      easy: false,
      medium: false,
      difficult: false,
      unknown: false,
    });

    expect(refs.pisteOverlay.alpha).toBe(HIDDEN_LAYER_ALPHA);
    expect(refs.pisteMarkerOverlay.visible).toBe(false);
    expect(refs.pisteLinesByDiff.easy.alpha).toBe(1);
    expect(refs.pisteMarkersByDiff.easy.visible).toBe(false);
  });
});

describe("applyPoiLayerVisibility", () => {
  it("dims point-of-interest layers instead of hiding them", () => {
    const container = new Container();

    applyPoiLayerVisibility(container, false);

    expect(container.alpha).toBe(HIDDEN_LAYER_ALPHA);
    expect(container.visible).toBe(true);
  });
});
