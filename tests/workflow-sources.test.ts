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

import { handleCurrentRisk } from "../lib/workflow";
import { fetchAirNowByLatLon } from "../lib/officialData/airnow";
import { fetchNwsWind } from "../lib/officialData/nws";

const entities = { location: "Tokyo" };

describe("handleCurrentRisk sources", () => {
  beforeEach(() => {
    vi.mocked(fetchAirNowByLatLon).mockReset();
    vi.mocked(fetchNwsWind).mockReset();
  });

  it("credits Open-Meteo when AirNow and NWS have no data", async () => {
    vi.mocked(fetchAirNowByLatLon).mockRejectedValue(new Error("not in US"));
    vi.mocked(fetchNwsWind).mockRejectedValue(new Error("not in US"));

    const result = await handleCurrentRisk({ ownerType: "user", ownerId: "u_sources_1", entities });

    expect(result.report?.sourcesUsed).toContain("Open-Meteo");
    expect(result.report?.sourcesUsed).not.toContain("AirNow");
    expect(result.report?.sourcesUsed).not.toContain("NWS");
    expect(result.report?.sourcesUsed?.filter(s => s === "Open-Meteo")).toHaveLength(1);
  });

  it("credits AirNow and NWS when they supply the data", async () => {
    vi.mocked(fetchAirNowByLatLon).mockResolvedValue({
      provider: "AirNow", aqi: 60, category: "Moderate", pollutant: "PM2.5",
    });
    vi.mocked(fetchNwsWind).mockResolvedValue({
      provider: "NWS", windSpeedMps: 4, windDirectionDeg: 270,
    });

    const result = await handleCurrentRisk({ ownerType: "user", ownerId: "u_sources_2", entities });

    expect(result.report?.sourcesUsed).toEqual(expect.arrayContaining(["AirNow", "NWS"]));
    expect(result.report?.sourcesUsed).not.toContain("Open-Meteo");
  });
});
