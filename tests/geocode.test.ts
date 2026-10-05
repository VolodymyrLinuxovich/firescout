import { afterEach, describe, expect, it, vi } from "vitest";
import { extractLocationFromText, geocode } from "../lib/geocode";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocode", () => {
  it("resolves known places without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await geocode("  BERKELEY ")).toMatchObject({ lat: 37.8715, lon: -122.273, radiusKm: 150 });
    expect(await geocode("Athens")).toMatchObject({ lat: 37.9838, lon: 23.7275 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("matches a known place followed by a qualifier", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await geocode("Berkeley, California")).toMatchObject({ lat: 37.8715, lon: -122.273 });
    expect(await geocode("Kyiv Ukraine")).toMatchObject({ lat: 50.4501, lon: 30.5234 });
  });

  it.each(["Lagos", "Sfax", "Lahore", "Santa Rosa"])("does not mistake %s for a known place", async (place) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await geocode(place)).toBeNull();
  });

  it("parses raw coordinates", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await geocode("37.8,-122.2")).toMatchObject({ lat: 37.8, lon: -122.2 });
    expect(await geocode("-33.9 18.4")).toMatchObject({ lat: -33.9, lon: 18.4 });
  });

  it("falls back to Nominatim for unknown places", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "44.97", lon: "-93.26", display_name: "Minneapolis" }],
    }));
    expect(await geocode("Minneapolis")).toEqual({ name: "Minneapolis", lat: 44.97, lon: -93.26, radiusKm: 150 });
  });

  it("returns null when Nominatim has no result or fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await geocode("Nowhereville")).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await geocode("Nowhereville")).toBeNull();
  });
});

describe("extractLocationFromText", () => {
  it("finds a known place and title cases it", () => {
    expect(extractLocationFromText("how is the air in san francisco today")).toBe("San Francisco");
    expect(extractLocationFromText("nothing here")).toBeNull();
  });

  it("matches whole words only", () => {
    expect(extractLocationFromText("is the air bad in atlanta")).toBeNull();
    expect(extractLocationFromText("is the air bad in la right now")).toBe("La");
    expect(extractLocationFromText("smoke near sfax?")).toBeNull();
  });
});
