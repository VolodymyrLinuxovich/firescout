/**
 * Simplified Gaussian plume model for smoke transport estimation.
 * This is an EXPLAINABLE ESTIMATE, not an official atmospheric chemistry forecast.
 * Wind direction = direction wind comes FROM (meteorological convention).
 * Smoke moves TOWARD windDirectionDeg + 180 degrees.
 */
import type { FireDetection, PlumeModelRun } from "./types";
import { latLonToMeters } from "./geo";

const MODEL_VERSION = "gaussian-plume-v1";
const GRID_N = 40;
const GRID_RADIUS_KM = 100;
const EFFECTIVE_HEIGHT_M = 100; // simplified plume height
const RECEPTOR_HEIGHT_M = 2;    // breathing height

function sigmaY(x: number): number {
  return Math.max(50, 0.22 * x * Math.pow(1 + 0.0001 * x, -0.5));
}

function sigmaZ(x: number): number {
  return Math.max(20, 0.20 * x);
}

// Source strength proxy from FRP or brightness
function sourceStrength(fire: FireDetection): number {
  if (fire.frp && fire.frp > 0) return Math.min(fire.frp * 10, 10000);
  if (fire.brightness && fire.brightness > 0) return Math.min(fire.brightness * 5, 5000);
  const conf = typeof fire.confidence === "number" ? fire.confidence : 50;
  return conf * 20;
}

// Gaussian plume concentration at (xDown, yCross) from a source
function plumeConcentration(
  Q: number,       // source strength (arbitrary units)
  u: number,       // wind speed m/s
  xDown: number,   // downwind distance m
  yCross: number,  // crosswind distance m
): number {
  if (xDown <= 0) return 0; // upwind gets no contribution
  const sy = sigmaY(xDown);
  const sz = sigmaZ(xDown);
  const H = EFFECTIVE_HEIGHT_M;
  const z = RECEPTOR_HEIGHT_M;
  const uFloor = Math.max(u, 1.0);

  const factor = Q / (2 * Math.PI * uFloor * sy * sz);
  const crosswind = Math.exp(-(yCross ** 2) / (2 * sy ** 2));
  const vertical =
    Math.exp(-((z - H) ** 2) / (2 * sz ** 2)) +
    Math.exp(-((z + H) ** 2) / (2 * sz ** 2));

  return factor * crosswind * vertical;
}

export function runPlumeModel(
  userLat: number,
  userLon: number,
  fires: FireDetection[],
  windSpeedMps: number,
  windDirectionDeg: number,  // direction wind comes FROM (meteorological)
): PlumeModelRun {
  // Smoke transport direction = wind FROM + 180
  const smokeDir = (windDirectionDeg + 180) % 360;
  const smokeDirRad = (smokeDir * Math.PI) / 180;

  const step = (GRID_RADIUS_KM * 2 * 1000) / GRID_N; // meters per cell
  const halfKm = GRID_RADIUS_KM * 1000;

  // Fire offsets from the user in local meters, computed once
  const sources = fires.map(fire => ({
    Q: sourceStrength(fire),
    ...latLonToMeters(fire.lat, fire.lon, userLat, userLon),
  }));

  // Total concentration at a point given in local meters from the user
  const concentrationAt = (px: number, py: number): number => {
    let totalC = 0;
    for (const { Q, dx: fdx, dy: fdy } of sources) {
      // Vector from fire to the point
      const ex = px - fdx;
      const ey = py - fdy;

      // Rotate into wind-aligned frame: +xDown = downwind
      // smokeDirRad is a compass bearing (0 = north, 90 = east), so the
      // downwind unit vector in (east, north) is (sin, cos)
      const xDown = ex * Math.sin(smokeDirRad) + ey * Math.cos(smokeDirRad);
      const yCross = ex * Math.cos(smokeDirRad) - ey * Math.sin(smokeDirRad);

      totalC += plumeConcentration(Q, windSpeedMps, xDown, yCross);
    }
    return totalC;
  };

  // Build grid in local meters centered on user
  const cells: Array<{ lat: number; lon: number; score: number }> = [];

  for (let iy = 0; iy < GRID_N; iy++) {
    for (let ix = 0; ix < GRID_N; ix++) {
      // Local meters offset from user center
      const dx = -halfKm + ix * step + step / 2;
      const dy = -halfKm + iy * step + step / 2;
      const totalC = concentrationAt(dx, dy);

      // Convert grid cell center back to lat/lon
      const cellLat = userLat + dy / 110540;
      const cellLon = userLon + dx / (Math.cos((userLat * Math.PI) / 180) * 111320);
      cells.push({ lat: cellLat, lon: cellLon, score: totalC });
    }
  }

  // The grid has an even size, so no cell is centered on the user.
  // Sample the plume at the user's exact position instead.
  const userRaw = concentrationAt(0, 0);

  // Normalize 0-100
  const maxRaw = Math.max(...cells.map(c => c.score), userRaw, 1e-10);
  const normalizedCells = cells.map(c => ({ ...c, score: (c.score / maxRaw) * 100 }));
  const plumeAtUserScore = (userRaw / maxRaw) * 100;

  // Build GeoJSON FeatureCollection
  const features: GeoJSON.Feature[] = normalizedCells
    .filter(c => c.score > 2)
    .map(c => ({
      type: "Feature" as const,
      properties: { plumeScore: Math.round(c.score) },
      geometry: {
        type: "Point" as const,
        coordinates: [c.lon, c.lat],
      },
    }));

  const plumeGeoJson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  return {
    modelVersion: MODEL_VERSION,
    plumeGeoJson,
    maxPlumeScore: 100,
    plumeAtUserScore: Math.round(plumeAtUserScore),
    windSpeedMps,
    windDirectionDeg,
    metadata: {
      note: "Satellite active-fire detections are point/thermal anomaly detections, not complete fire perimeter maps.",
      label: "Explainable wind-based plume estimate.",
      gridN: GRID_N,
      gridRadiusKm: GRID_RADIUS_KM,
      fireCount: fires.length,
      smokeTransportDirection: smokeDir,
    },
  };
}
