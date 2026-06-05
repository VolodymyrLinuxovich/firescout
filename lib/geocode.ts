import type { Location } from "./types";

const DEMO_PLACES: Record<string, { lat: number; lon: number }> = {
  "berkeley": { lat: 37.8715, lon: -122.2730 },
  "berkeley, ca": { lat: 37.8715, lon: -122.2730 },
  "oakland": { lat: 37.8044, lon: -122.2712 },
  "oakland, ca": { lat: 37.8044, lon: -122.2712 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  "sf": { lat: 37.7749, lon: -122.4194 },
  "san francisco, ca": { lat: 37.7749, lon: -122.4194 },
  "joshua tree": { lat: 33.8734, lon: -115.9010 },
  "joshua tree national park": { lat: 33.8734, lon: -115.9010 },
  "mojave": { lat: 35.1417, lon: -115.5104 },
  "mojave national preserve": { lat: 35.1417, lon: -115.5104 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  "la": { lat: 34.0522, lon: -118.2437 },
  "sacramento": { lat: 38.5816, lon: -121.4944 },
};

export async function geocode(placeName: string): Promise<Location | null> {
  const key = placeName.toLowerCase().trim();
  const coords = DEMO_PLACES[key];

  if (coords) {
    return {
      name: placeName,
      lat: coords.lat,
      lon: coords.lon,
      radiusKm: 150,
    };
  }

  // Try Nominatim for unknown places
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "FireScout Hackathon [contact@example.com]" },
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.length > 0) {
        return {
          name: placeName,
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          radiusKm: 150,
        };
      }
    }
  } catch {
    // Nominatim unavailable — demo places only
  }

  return null;
}

export function extractLocationFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const place of Object.keys(DEMO_PLACES)) {
    if (lower.includes(place)) {
      // Return canonical capitalized name
      return place.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}
