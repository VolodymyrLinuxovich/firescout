import type {
  AirQualityObservation,
  FireDetection,
  RiskLevel,
  RiskScoreComponents,
  Confidence,
} from "./types";

const AQI_SCORE: Record<string, number> = {
  Good: 0,
  Moderate: 25,
  "Unhealthy for Sensitive Groups": 50,
  Unhealthy: 75,
  "Very Unhealthy": 90,
  Hazardous: 100,
};

function aqiToCategory(aqi: number | null): string {
  if (aqi === null) return "Unknown";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function aqiScore(obs: AirQualityObservation | null | undefined): number {
  if (!obs) return 30;
  const cat = obs.category ?? aqiToCategory(obs.aqi);
  return AQI_SCORE[cat] ?? 30;
}

function trendScore(
  current: AirQualityObservation | null | undefined,
  previous: AirQualityObservation | null | undefined
): number {
  if (!current || !previous) return 0;
  const cats = ["Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous"];
  const curCat = current.category ?? aqiToCategory(current.aqi);
  const prevCat = previous.category ?? aqiToCategory(previous.aqi);
  const curIdx = cats.indexOf(curCat);
  const prevIdx = cats.indexOf(prevCat);
  if (curIdx < 0 || prevIdx < 0) return 0;
  const delta = curIdx - prevIdx;
  if (delta === 0) return 0;
  if (delta === 1) return 40;
  if (delta === 2) return 70;
  if (delta >= 3) return 100;
  return -15; // improving
}

function fireProximityScore(fires: FireDetection[]): number {
  if (!fires.length) return 0;
  const nearest = Math.min(...fires.map(f => f.distanceKm ?? 9999));
  if (nearest > 200) return 0;
  if (nearest > 100) return 25;
  if (nearest > 50) return 50;
  if (nearest > 20) return 75;
  return 100;
}

function activityScore(activity: string | null | undefined): number {
  if (!activity) return 10;
  const a = activity.toLowerCase();
  if (a.includes("run") || a.includes("exercise") || a.includes("cycling") || a.includes("bike")) return 75;
  if (a.includes("walk")) return 30;
  if (a.includes("commute") || a.includes("drive")) return 20;
  if (a.includes("indoor")) return 0;
  return 10;
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score <= 25) return "CLEAR";
  if (score <= 50) return "WATCH";
  if (score <= 75) return "ACT";
  return "CRITICAL";
}

function mainDriverLabel(components: {
  aqiScore: number;
  plumeScore: number;
  trendScore: number;
  fireProximityScore: number;
  activityScore: number;
}): string {
  const weighted = [
    { label: "AirNow / PM2.5 measurements", value: components.aqiScore * 0.45 },
    { label: "modeled plume transport", value: components.plumeScore * 0.25 },
    { label: "trend since last report", value: Math.abs(components.trendScore) * 0.15 },
    { label: "nearby active fire detections", value: components.fireProximityScore * 0.10 },
    { label: "user activity", value: components.activityScore * 0.05 },
  ];
  weighted.sort((a, b) => b.value - a.value);
  return weighted[0].label;
}

export function computeRiskScore(params: {
  airQuality?: AirQualityObservation | null;
  previousAirQuality?: AirQualityObservation | null;
  fires?: FireDetection[];
  plumeAtUserScore?: number;
  activity?: string | null;
}): RiskScoreComponents {
  const aScore = aqiScore(params.airQuality);
  const tScore = trendScore(params.airQuality, params.previousAirQuality);
  const fScore = fireProximityScore(params.fires ?? []);
  const pScore = params.plumeAtUserScore ?? 0;
  const aAct = activityScore(params.activity);

  const finalRisk =
    0.45 * aScore +
    0.25 * pScore +
    0.15 * tScore +
    0.10 * fScore +
    0.05 * aAct;

  const level = riskLevelFromScore(finalRisk);

  const components = { aqiScore: aScore, plumeScore: pScore, trendScore: tScore, fireProximityScore: fScore, activityScore: aAct };

  let confidence: Confidence = "Low";
  if (params.airQuality?.aqi != null) {
    confidence = "Medium";
    if (params.fires !== undefined && params.plumeAtUserScore !== undefined) {
      confidence = "High";
    }
  }

  return {
    ...components,
    finalRisk: Math.round(Math.min(finalRisk, 100)),
    riskLevel: level,
    mainDriver: mainDriverLabel(components),
    confidence,
  };
}

export function getRecommendation(level: RiskLevel, activity: string | null | undefined): string {
  const isRunner = activity?.toLowerCase().includes("run") || activity?.toLowerCase().includes("exercise");
  switch (level) {
    case "CLEAR":
      return isRunner
        ? "Outdoor running looks reasonable right now. Conditions can change — check again before heading out."
        : "Conditions look good. Enjoy being outside.";
    case "WATCH":
      return isRunner
        ? "Skip hard outdoor running for now. Light activity may be okay. Check again later before committing to a workout."
        : "Consider limiting time outdoors if you are sensitive to air quality. Check back soon.";
    case "ACT":
      return "Avoid hard outdoor exercise. Close windows if you smell smoke. Follow local official guidance for air quality advisories.";
    case "CRITICAL":
      return "Avoid outdoor exposure if possible. Follow official emergency and public-health guidance. FireScout is not an evacuation authority.";
  }
}

export function getSummaryText(
  locationName: string,
  level: RiskLevel,
  mainDriver: string,
  activity: string | null | undefined,
  whatChanged: string | null | undefined,
  confidence: Confidence,
  sources: string[]
): string {
  const messages: Record<RiskLevel, string> = {
    CLEAR: `${locationName} looks CLEAR right now. AirNow measurements are in a good range, and the plume model does not show meaningful smoke transport toward your location.`,
    WATCH: `${locationName} is at WATCH level. The main concern is ${mainDriver}. I would avoid hard outdoor exercise for now and check again later.`,
    ACT: `${locationName} is at ACT level. Smoke risk is meaningfully elevated due to ${mainDriver}. Avoid hard outdoor exercise, close windows if you smell smoke, and follow local official guidance.`,
    CRITICAL: `${locationName} is at CRITICAL level due to ${mainDriver}. Avoid outdoor exposure if possible and follow official emergency/public-health guidance. FireScout is not an evacuation authority.`,
  };

  let text = `**FireScout — ${locationName}**\n\n`;
  text += `**Level: ${level}**\n\n`;
  text += messages[level] + "\n\n";

  if (whatChanged) {
    text += `**What changed:** ${whatChanged}\n\n`;
  }

  text += `**Recommendation:** ${getRecommendation(level, activity)}\n\n`;
  text += `**Confidence:** ${confidence}\n`;
  text += `**Sources:** ${sources.join(", ")}\n\n`;
  text += `_FireScout is decision support, not an emergency authority. For evacuation or emergency guidance, follow local officials, CAL FIRE, NWS, and emergency alerts._`;

  return text;
}
