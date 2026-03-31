import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRestaurants } from "./fetch-osm-restaurants.mjs";

describe("parseRestaurants", () => {
  it("parses a node restaurant", () => {
    const elements = [
      {
        type: "node",
        id: 123,
        lat: 47.136,
        lon: 11.870,
        tags: { amenity: "restaurant", name: "Ahornhütte" },
      },
    ];
    const result = parseRestaurants(elements);
    assert.equal(result.length, 1);
    assert.equal(result[0].osmId, "node/123");
    assert.equal(result[0].name, "Ahornhütte");
    assert.equal(result[0].amenityType, "restaurant");
    assert.deepStrictEqual(result[0].geo, { lat: 47.136, lng: 11.870 });
  });

  it("parses a way restaurant using centroid", () => {
    const elements = [
      {
        type: "way",
        id: 456,
        tags: { amenity: "restaurant", name: "Bergrast" },
        geometry: [
          { lat: 47.175, lon: 11.828 },
          { lat: 47.176, lon: 11.829 },
          { lat: 47.175, lon: 11.829 },
          { lat: 47.175, lon: 11.828 },
        ],
      },
    ];
    const result = parseRestaurants(elements);
    assert.equal(result.length, 1);
    assert.equal(result[0].osmId, "way/456");
    assert.ok(Math.abs(result[0].geo.lat - 47.17525) < 0.001);
  });

  it("skips elements without names", () => {
    const elements = [
      {
        type: "node",
        id: 789,
        lat: 47.1,
        lon: 11.8,
        tags: { amenity: "restaurant" },
      },
    ];
    const result = parseRestaurants(elements);
    assert.equal(result.length, 0);
  });

  it("skips aerialway ways", () => {
    const elements = [
      {
        type: "way",
        id: 999,
        tags: { aerialway: "gondola", amenity: "restaurant", name: "Station Cafe" },
        geometry: [{ lat: 47.1, lon: 11.8 }, { lat: 47.2, lon: 11.9 }],
      },
    ];
    const result = parseRestaurants(elements);
    assert.equal(result.length, 0);
  });

  it("handles tourism tags (alpine_hut, wilderness_hut)", () => {
    const elements = [
      {
        type: "node",
        id: 111,
        lat: 47.13,
        lon: 11.89,
        tags: { tourism: "alpine_hut", name: "Edelhütte" },
      },
    ];
    const result = parseRestaurants(elements);
    assert.equal(result.length, 1);
    assert.equal(result[0].amenityType, "alpine_hut");
  });
});
