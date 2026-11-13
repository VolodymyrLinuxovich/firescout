import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/officialData/airnow", () => ({ fetchAirNowByLatLon: vi.fn() }));
vi.mock("../lib/officialData/nws", () => ({ fetchNwsWind: vi.fn() }));
vi.mock("../lib/officialData/firms", () => ({ fetchFirmsActiveFires: vi.fn(async () => []) }));
vi.mock("../lib/officialData/openmeteo", () => ({
  fetchOpenMeteoAirQuality: vi.fn(async () => ({
    provider: "Open-Meteo", aqi: 40, category: "Good", pollutant: "PM2.5",
  })),
  fetchOpenMeteoWind: vi.fn(async () => ({
    provider: "Open-Meteo", windSpeedMps: 3, windDirectionDeg: 200,
  })),
}));
vi.mock("../lib/integrations/gemini", () => ({ generateRiskResponse: vi.fn(async () => null) }));
vi.mock("../lib/integrations/photon", () => ({ sendMessage: vi.fn(async () => true) }));
vi.mock("../lib/integrations/xtrace", () => ({
  getUserMemory: vi.fn(async () => []),
  writeUserMemory: vi.fn(async () => {}),
  writeArtifact: vi.fn(async () => {}),
  reviseMemory: vi.fn(async () => {}),
}));

import { handleWhatChanged } from "../lib/workflow";
import { fetchAirNowByLatLon } from "../lib/officialData/airnow";
import { fetchNwsWind } from "../lib/officialData/nws";

const entities = { location: "Tokyo" };

describe("handleWhatChanged", () => {
  beforeEach(() => {
    vi.mocked(fetchAirNowByLatLon).mockReset();
    vi.mocked(fetchNwsWind).mockReset();
  });

  it("falls back to Open-Meteo outside the US", async () => {
    vi.mocked(fetchAirNowByLatLon).mockRejectedValue(new Error("not in US"));
    vi.mocked(fetchNwsWind).mockRejectedValue(new Error("not in US"));

    const result = await handleWhatChanged({ ownerType: "user", ownerId: "u_changed_1", entities });
    const deltas = (result.deltaReport?.deltas ?? []) as string[];

    expect(deltas.some(d => d.startsWith("AQI: 40"))).toBe(true);
    expect(deltas.some(d => d.startsWith("Wind: 3.0 m/s"))).toBe(true);
    expect(result.text).not.toContain("Confidence: Low");
  });

  it("still uses AirNow and NWS when they answer", async () => {
    vi.mocked(fetchAirNowByLatLon).mockResolvedValue({
      provider: "AirNow", aqi: 60, category: "Moderate", pollutant: "PM2.5",
    });
    vi.mocked(fetchNwsWind).mockResolvedValue({
      provider: "NWS", windSpeedMps: 4, windDirectionDeg: 270,
    });

    const result = await handleWhatChanged({ ownerType: "user", ownerId: "u_changed_2", entities });
    const deltas = (result.deltaReport?.deltas ?? []) as string[];

    expect(deltas.some(d => d.startsWith("AQI: 60"))).toBe(true);
    expect(deltas.some(d => d.startsWith("Wind: 4.0 m/s"))).toBe(true);
  });
});
