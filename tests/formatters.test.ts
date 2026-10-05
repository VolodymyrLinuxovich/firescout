import { describe, expect, it } from "vitest";
import { aqiCategoryDelta, classifyIntent, confirmLocationMessage, formatDelta } from "../lib/formatters";

describe("classifyIntent", () => {
  it.each([
    ["Monitor Berkeley for outdoor running", "add_location"],
    ["How bad is it right now?", "current_risk"],
    ["Show me the smoke risk map", "show_map"],
    ["What changed since yesterday?", "what_changed"],
    ["Why is smoke bad?", "explain_science"],
    ["Send me a daily brief", "daily_brief"],
    ["Change my settings", "update_preferences"],
    ["hello there", "unknown"],
  ])("classifies %j as %s", (text, intent) => {
    expect(classifyIntent(text).intent).toBe(intent);
  });

  it("extracts the location and activity", () => {
    const { entities } = classifyIntent("Monitor Berkeley for outdoor running");
    expect(entities.location).toBe("Berkeley");
    expect(entities.activity).toBe("running");
  });

  it("keeps the original text as the query", () => {
    expect(classifyIntent("Is it safe to walk?").entities).toMatchObject({
      query: "Is it safe to walk?",
      activity: "walking",
    });
  });
});

describe("formatDelta", () => {
  it("describes a change", () => {
    expect(formatDelta("PM2.5", 12, 40, " µg/m³")).toBe("PM2.5: 12 µg/m³ → 40 µg/m³");
  });

  it("is empty when nothing changed or a value is missing", () => {
    expect(formatDelta("AQI", 50, 50)).toBe("");
    expect(formatDelta("AQI", null, 50)).toBe("");
  });
});

describe("aqiCategoryDelta", () => {
  it("reports changed and unchanged categories", () => {
    expect(aqiCategoryDelta("Good", "Moderate")).toBe("AQI category changed: Good → Moderate");
    expect(aqiCategoryDelta("Good", "Good")).toBe("AQI category unchanged (Good)");
    expect(aqiCategoryDelta(null, "Good")).toBe("");
  });
});

describe("confirmLocationMessage", () => {
  it("mentions the activity only when one is given", () => {
    expect(confirmLocationMessage("Berkeley")).not.toContain("keep in mind");
    expect(confirmLocationMessage("Berkeley", "running")).toContain("**running**");
  });
});
