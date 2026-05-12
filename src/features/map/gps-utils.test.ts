import { describe, expect, it } from "vitest";
import { distanceMeters, findNearestAnchor, resolveGpsAnchorMatch } from "./gps-utils";
import type { AnchorPoint } from "./map-shell-types";

function anchor(id: string, lat: number, lng: number, snapRadius = 200): AnchorPoint {
  return {
    id,
    name: id,
    type: "test",
    geo: { lat, lng },
    panorama: { x: 0, y: 0 },
    snapRadius,
  };
}

describe("distanceMeters", () => {
  it("returns 0 for identical coordinates", () => {
    expect(distanceMeters({ lat: 47.2, lng: 11.9 }, { lat: 47.2, lng: 11.9 })).toBe(0);
  });

  it("measures about 111 meters for 0.001 longitude degrees at the equator", () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeCloseTo(111, 0);
  });
});

describe("findNearestAnchor", () => {
  it("returns null when there are no anchors", () => {
    expect(findNearestAnchor({ lat: 47.2, lng: 11.9 }, [])).toBeNull();
  });

  it("ignores anchors outside their snap radius", () => {
    const anchors = [anchor("far", 47.2, 11.9, 10)];

    expect(findNearestAnchor({ lat: 47.201, lng: 11.9 }, anchors)).toBeNull();
  });

  it("returns the only anchor inside its snap radius", () => {
    const anchors = [anchor("near", 47.2, 11.9, 200)];

    expect(findNearestAnchor({ lat: 47.201, lng: 11.9 }, anchors)?.anchor.id).toBe("near");
  });

  it("returns the closest anchor when multiple anchors are inside snap radius", () => {
    const anchors = [anchor("farther", 47.202, 11.9), anchor("closer", 47.2005, 11.9)];

    expect(findNearestAnchor({ lat: 47.2, lng: 11.9 }, anchors)?.anchor.id).toBe("closer");
  });

  it("matches the Seppi's sensor coordinate to the Seppi's anchor", () => {
    const anchors = [anchor("seppis", 47.2414325, 12.0376423, 400)];

    const match = findNearestAnchor({ lat: 47.2414311, lng: 12.0375738 }, anchors);

    expect(match?.anchor.id).toBe("seppis");
    expect(match?.distance).toBeLessThan(10);
  });
});

describe("resolveGpsAnchorMatch", () => {
  it("returns the nearest anchor when there is no previous match", () => {
    const anchors = [anchor("a", 47.201, 11.9), anchor("b", 47.2005, 11.9)];

    expect(resolveGpsAnchorMatch({ lat: 47.2, lng: 11.9 }, anchors, null)?.anchor.id).toBe("b");
  });

  it("keeps the previous anchor when the new candidate is not more than the hysteresis distance better", () => {
    const anchors = [anchor("previous", 47.2005, 11.9), anchor("candidate", 47.2003, 11.9)];

    expect(resolveGpsAnchorMatch({ lat: 47.2, lng: 11.9 }, anchors, "previous")?.anchor.id).toBe("previous");
  });

  it("switches to the new candidate when it is more than the hysteresis distance better", () => {
    const anchors = [anchor("previous", 47.201, 11.9), anchor("candidate", 47.2001, 11.9)];

    expect(resolveGpsAnchorMatch({ lat: 47.2, lng: 11.9 }, anchors, "previous")?.anchor.id).toBe("candidate");
  });

  it("falls back to nearest anchor when the previous anchor id does not exist", () => {
    const anchors = [anchor("nearest", 47.2005, 11.9)];

    expect(resolveGpsAnchorMatch({ lat: 47.2, lng: 11.9 }, anchors, "missing")?.anchor.id).toBe("nearest");
  });

  it("falls back to nearest anchor when the previous anchor is outside its snap radius", () => {
    const anchors = [anchor("previous", 47.205, 11.9, 50), anchor("nearest", 47.2005, 11.9)];

    expect(resolveGpsAnchorMatch({ lat: 47.2, lng: 11.9 }, anchors, "previous")?.anchor.id).toBe("nearest");
  });
});
