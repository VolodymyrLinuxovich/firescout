export interface IntentResult {
  intent: string;
  entities: Record<string, string>;
}

export function classifyIntent(text: string): IntentResult {
  const lower = text.toLowerCase();
  const entities: Record<string, string> = {};

  // Extract location hints
  const locationWords = ["berkeley", "oakland", "san francisco", "joshua tree", "mojave", "los angeles", "sacramento"];
  for (const loc of locationWords) {
    if (lower.includes(loc)) {
      entities.location = loc.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      break;
    }
  }

  // Extract activity hints
  if (lower.includes("run") || lower.includes("exercise") || lower.includes("jog")) entities.activity = "running";
  else if (lower.includes("walk")) entities.activity = "walking";
  else if (lower.includes("commute") || lower.includes("drive")) entities.activity = "commute";

  // Intent classification — order matters
  if (lower.match(/\b(monitor|track|watch|add|start monitoring)\b/)) return { intent: "add_location", entities };
  if (lower.match(/\b(map|show map|satellite|visual|picture)\b/)) return { intent: "show_map", entities };
  if (lower.match(/\b(changed|worse|better|since yesterday|since last|different|update)\b/)) return { intent: "what_changed", entities };
  if (lower.match(/\b(why|explain|science|how does|what is pm|what are particles)\b/)) return { intent: "explain_science", entities };
  if (lower.match(/\b(daily|brief|alert|remind|schedule|morning)\b/)) return { intent: "daily_brief", entities };
  if (lower.match(/\b(prefer|settings|threshold|activity|set)\b/)) return { intent: "update_preferences", entities };
  if (lower.match(/\b(bad|good|safe|risk|now|how|current|outside|go out|run|exercise|air|smoke|aqi)\b/)) return { intent: "current_risk", entities };

  return { intent: "unknown", entities };
}

export function scienceExplanation(): string {
  return `**Why is smoke bad?**

Wildfire smoke contains PM2.5 — tiny particles small enough to get deep into your lungs.

During exercise, you breathe harder and faster, which means you inhale more particles per minute. That is why FireScout treats outdoor running as higher risk when AQI or modeled smoke transport rises.

Even when the sky does not look dramatically orange, PM2.5 can be elevated at ground level. Sensitive groups — people with asthma, heart disease, or lung conditions, as well as children and the elderly — can feel effects at lower AQI levels than healthy adults.

_FireScout uses official AirNow measurements (real-time PM2.5 data collected using EPA-approved methods) combined with a wind-based plume model to estimate smoke transport. It is decision support, not a medical authority._`;
}

export function confirmLocationMessage(name: string, activity?: string): string {
  let msg = `Got it — I'll monitor **${name}** for wildfire smoke.`;
  if (activity) msg += ` I'll keep in mind you care about **${activity}** when sending risk alerts.`;
  msg += `\n\nSay _"How bad is it right now?"_ to get your first smoke risk check.`;
  return msg;
}

export function formatDelta(
  field: string,
  prev: unknown,
  curr: unknown,
  unit = ""
): string {
  if (prev === curr || prev === null || curr === null) return "";
  const prevStr = `${prev}${unit}`;
  const currStr = `${curr}${unit}`;
  return `${field}: ${prevStr} → ${currStr}`;
}

export function aqiCategoryDelta(prevCat: string | null, currCat: string | null): string {
  if (!prevCat || !currCat) return "";
  if (prevCat === currCat) return `AQI category unchanged (${currCat})`;
  return `AQI category changed: ${prevCat} → ${currCat}`;
}
