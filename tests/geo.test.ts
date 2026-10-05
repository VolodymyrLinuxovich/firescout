import { describe, expect, it } from "vitest";
import { bearing, destinationPoint, distanceKm, latLonToMeters } from "../lib/geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm(37.87, -122.27, 37.87, -122.27)).toBe(0);
  });

  it("matches one degree of longitude at the equator", () => {
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  it("is symmetric", () => {
    const a = distanceKm(37.87, -122.27, 34.05, -118.24);
    const b = distanceKm(34.05, -118.24, 37.87, -122.27);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe("bearing", () => {
  it("returns compass bearings for the cardinal directions", () => {
    expect(bearing(0, 0, 1, 0)).toBeCloseTo(0, 6);
    expect(bearing(0, 0, 0, 1)).toBeCloseTo(90, 6);
    expect(bearing(0, 0, -1, 0)).toBeCloseTo(180, 6);
    expect(bearing(0, 0, 0, -1)).toBeCloseTo(270, 6);
  });
});

describe("destinationPoint", () => {
  it("lands the requested distance and bearing away", () => {
    const start = { lat: 37.87, lon: -122.27 };
    const end = destinationPoint(start.lat, start.lon, 60, 50);
    expect(distanceKm(start.lat, start.lon, end.lat, end.lon)).toBeCloseTo(50, 6);
    expect(bearing(start.lat, start.lon, end.lat, end.lon)).toBeCloseTo(60, 1);
  });
});

describe("latLonToMeters", () => {
  it("puts north on +dy and east on +dx", () => {
    const north = latLonToMeters(38, -122, 37, -122);
    expect(north.dx).toBeCloseTo(0, 6);
    expect(north.dy).toBeCloseTo(110540, 6);

    const east = latLonToMeters(37, -121, 37, -122);
    expect(east.dx).toBeGreaterThan(0);
    expect(east.dy).toBeCloseTo(0, 6);
  });
});
