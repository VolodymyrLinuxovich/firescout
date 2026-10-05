import { describe, expect, it } from "vitest";
import { runPlumeModel } from "../lib/plume";
import type { FireDetection } from "../lib/types";

const USER = { lat: 37.87, lon: -122.27 };

function fireAt(dNorthKm: number, dEastKm: number): FireDetection {
  return {
    provider: "NASA_FIRMS",
    source: "VIIRS",
    lat: USER.lat + dNorthKm / 110.54,
    lon: USER.lon + dEastKm / (Math.cos((USER.lat * Math.PI) / 180) * 111.32),
    frp: 100,
  };
}

// Score-weighted centre of the plume features, in degrees relative to the fire
function plumeCentroid(fire: FireDetection, windFromDeg: number) {
  const run = runPlumeModel(USER.lat, USER.lon, [fire], 5, windFromDeg);
  let sumLat = 0;
  let sumLon = 0;
  let total = 0;
  for (const f of run.plumeGeoJson.features) {
    const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
    const score = f.properties!.plumeScore as number;
    sumLat += (lat - fire.lat) * score;
    sumLon += (lon - fire.lon) * score;
    total += score;
  }
  return { dLat: sumLat / total, dLon: sumLon / total };
}

describe("runPlumeModel", () => {
  it("returns an empty plume when there are no fires", () => {
    const run = runPlumeModel(USER.lat, USER.lon, [], 5, 270);
    expect(run.plumeGeoJson.features).toHaveLength(0);
    expect(run.plumeAtUserScore).toBe(0);
  });

  it("reports smoke transport as the opposite of the wind direction", () => {
    expect(runPlumeModel(USER.lat, USER.lon, [], 5, 240).metadata.smokeTransportDirection).toBe(60);
    expect(runPlumeModel(USER.lat, USER.lon, [], 5, 90).metadata.smokeTransportDirection).toBe(270);
  });

  it.each([
    ["south", 0],
    ["west", 90],
    ["north", 180],
    ["east", 270],
  ] as const)("blows smoke %s when the wind comes from %i°", (expected, windFrom) => {
    const fire = fireAt(0, 0);
    const { dLat, dLon } = plumeCentroid(fire, windFrom);
    const along = { north: dLat, south: -dLat, east: dLon, west: -dLon }[expected]!;
    const across = expected === "north" || expected === "south" ? dLon : dLat;
    expect(along).toBeGreaterThan(0.1);
    expect(Math.abs(across)).toBeLessThan(0.01);
  });

  it("reaches the user only when the wind blows from the fire toward them", () => {
    const fireToSouth = fireAt(-50, 0);
    const towardUser = runPlumeModel(USER.lat, USER.lon, [fireToSouth], 5, 180);
    const awayFromUser = runPlumeModel(USER.lat, USER.lon, [fireToSouth], 5, 0);
    const crosswind = runPlumeModel(USER.lat, USER.lon, [fireToSouth], 5, 270);

    expect(towardUser.plumeAtUserScore).toBeGreaterThan(0);
    expect(awayFromUser.plumeAtUserScore).toBe(0);
    expect(crosswind.plumeAtUserScore).toBe(0);
  });

  it("keeps normalized scores between 0 and 100", () => {
    const run = runPlumeModel(USER.lat, USER.lon, [fireAt(-20, -20), fireAt(30, 10)], 3, 225);
    const scores = run.plumeGeoJson.features.map(f => f.properties!.plumeScore as number);
    expect(scores.length).toBeGreaterThan(0);
    expect(Math.max(...scores)).toBe(100);
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(0);
  });
});
