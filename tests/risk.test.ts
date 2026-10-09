import { describe, expect, it } from "vitest";
import { computeRiskScore, getRecommendation, getSummaryText, riskLevelFromScore } from "../lib/risk";
import type { AirQualityObservation, FireDetection } from "../lib/types";

function air(aqi: number | null, category: string | null = null): AirQualityObservation {
  return { provider: "AirNow", aqi, category, pollutant: "PM2.5" };
}

function fire(distanceKm: number): FireDetection {
  return { provider: "NASA_FIRMS", source: "VIIRS", lat: 0, lon: 0, distanceKm };
}

describe("riskLevelFromScore", () => {
  it.each([
    [0, "CLEAR"],
    [25, "CLEAR"],
    [25.1, "WATCH"],
    [50, "WATCH"],
    [75, "ACT"],
    [76, "CRITICAL"],
    [100, "CRITICAL"],
  ])("maps %s to %s", (score, level) => {
    expect(riskLevelFromScore(score)).toBe(level);
  });
});

describe("computeRiskScore", () => {
  it("weights AQI category and activity with no other signals", () => {
    const result = computeRiskScore({ airQuality: air(112, "Unhealthy for Sensitive Groups") });
    // 0.45 * 50 + 0.05 * 10 (no activity given)
    expect(result.aqiScore).toBe(50);
    expect(result.finalRisk).toBe(23);
    expect(result.riskLevel).toBe("CLEAR");
    expect(result.confidence).toBe("Medium");
  });

  it("derives the AQI category from the number when the category is missing", () => {
    expect(computeRiskScore({ airQuality: air(40) }).aqiScore).toBe(0);
    expect(computeRiskScore({ airQuality: air(180) }).aqiScore).toBe(75);
    expect(computeRiskScore({ airQuality: air(350) }).aqiScore).toBe(100);
  });

  it("falls back to a middle AQI score and low confidence without measurements", () => {
    const result = computeRiskScore({});
    expect(result.aqiScore).toBe(30);
    expect(result.confidence).toBe("Low");
  });

  it("scores the worst case as CRITICAL with high confidence", () => {
    const result = computeRiskScore({
      airQuality: air(400, "Hazardous"),
      previousAirQuality: air(20, "Good"),
      fires: [fire(10)],
      plumeAtUserScore: 100,
      activity: "outdoor running",
    });
    expect(result.trendScore).toBe(100);
    expect(result.fireProximityScore).toBe(100);
    expect(result.activityScore).toBe(75);
    expect(result.finalRisk).toBe(99);
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.confidence).toBe("High");
    expect(result.mainDriver).toBe("AirNow / PM2.5 measurements");
  });

  it("lowers the score when air quality is improving", () => {
    const steady = computeRiskScore({ airQuality: air(120, "Unhealthy for Sensitive Groups") });
    const improving = computeRiskScore({
      airQuality: air(120, "Unhealthy for Sensitive Groups"),
      previousAirQuality: air(180, "Unhealthy"),
    });
    expect(improving.trendScore).toBe(-15);
    expect(improving.finalRisk).toBeLessThan(steady.finalRisk);
  });

  it.each([
    [10, 100],
    [30, 75],
    [80, 50],
    [150, 25],
    [250, 0],
  ])("scores the nearest fire at %s km as %s", (km, expected) => {
    expect(computeRiskScore({ fires: [fire(400), fire(km)] }).fireProximityScore).toBe(expected);
  });

  it.each([
    ["outdoor running", 75],
    ["cycling", 75],
    ["walking the dog", 30],
    ["commute", 20],
    ["indoor", 0],
    [null, 10],
  ])("scores activity %s as %s", (activity, expected) => {
    expect(computeRiskScore({ activity }).activityScore).toBe(expected);
  });

  it("names the plume as the main driver when it dominates", () => {
    const result = computeRiskScore({ airQuality: air(30, "Good"), plumeAtUserScore: 90 });
    expect(result.mainDriver).toBe("modeled plume transport");
  });
});

describe("getRecommendation", () => {
  it("gives runners specific advice at low levels", () => {
    expect(getRecommendation("WATCH", "running")).toMatch(/Skip hard outdoor running/);
    expect(getRecommendation("WATCH", "reading")).not.toMatch(/running/);
  });

  it("never presents itself as an evacuation authority at CRITICAL", () => {
    expect(getRecommendation("CRITICAL", null)).toMatch(/not an evacuation authority/);
  });
});

describe("getSummaryText", () => {
  it("includes the level, what changed, sources and the disclaimer", () => {
    const text = getSummaryText("Berkeley", "ACT", "modeled plume transport", "running", "AQI rose 40 points", "High", ["AirNow", "NASA FIRMS"]);
    expect(text).toContain("**Level: ACT**");
    expect(text).toContain("due to modeled plume transport");
    expect(text).toContain("**What changed:** AQI rose 40 points");
    expect(text).toContain("**Sources:** AirNow, NASA FIRMS");
    expect(text).toMatch(/not an emergency authority/);
  });

  it("omits the what changed line when nothing changed", () => {
    const text = getSummaryText("Berkeley", "CLEAR", "user activity", null, null, "Low", []);
    expect(text).not.toContain("What changed");
  });
});

describe("computeRiskScore range", () => {
  it("never returns a negative score when air quality improves", () => {
    const result = computeRiskScore({
      airQuality: air(30, "Good"),
      previousAirQuality: air(70, "Moderate"),
      fires: [],
    });
    expect(result.trendScore).toBe(-15);
    expect(result.finalRisk).toBe(0);
    expect(result.riskLevel).toBe("CLEAR");
  });

  it("picks the level from the rounded score it reports", () => {
    // 0.45 * 25 + 0.25 * 41 + 0.05 * 75 = 25.25, shown as 25
    const result = computeRiskScore({
      airQuality: air(70, "Moderate"),
      fires: [],
      plumeAtUserScore: 41,
      activity: "running",
    });
    expect(result.finalRisk).toBe(25);
    expect(result.riskLevel).toBe(riskLevelFromScore(result.finalRisk));
    expect(result.riskLevel).toBe("CLEAR");
  });
});
