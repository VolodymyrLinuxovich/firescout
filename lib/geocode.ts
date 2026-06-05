import type { Location } from "./types";

const KNOWN_PLACES: Record<string, { lat: number; lon: number }> = {
  // Bay Area
  "berkeley": { lat: 37.8715, lon: -122.2730 },
  "berkeley, ca": { lat: 37.8715, lon: -122.2730 },
  "oakland": { lat: 37.8044, lon: -122.2712 },
  "oakland, ca": { lat: 37.8044, lon: -122.2712 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  "sf": { lat: 37.7749, lon: -122.4194 },
  "san francisco, ca": { lat: 37.7749, lon: -122.4194 },
  // California
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  "la": { lat: 34.0522, lon: -118.2437 },
  "los angeles, ca": { lat: 34.0522, lon: -118.2437 },
  "san diego": { lat: 32.7157, lon: -117.1611 },
  "sacramento": { lat: 38.5816, lon: -121.4944 },
  "joshua tree": { lat: 33.8734, lon: -115.9010 },
  "mojave": { lat: 35.1417, lon: -115.5104 },
  // North America
  "new york": { lat: 40.7128, lon: -74.0060 },
  "nyc": { lat: 40.7128, lon: -74.0060 },
  "chicago": { lat: 41.8781, lon: -87.6298 },
  "seattle": { lat: 47.6062, lon: -122.3321 },
  "portland": { lat: 45.5231, lon: -122.6765 },
  "denver": { lat: 39.7392, lon: -104.9903 },
  "phoenix": { lat: 33.4484, lon: -112.0740 },
  "miami": { lat: 25.7617, lon: -80.1918 },
  "toronto": { lat: 43.6532, lon: -79.3832 },
  "vancouver": { lat: 49.2827, lon: -123.1207 },
  "mexico city": { lat: 19.4326, lon: -99.1332 },
  // Europe
  "athens": { lat: 37.9838, lon: 23.7275 },
  "athens, greece": { lat: 37.9838, lon: 23.7275 },
  "london": { lat: 51.5074, lon: -0.1278 },
  "paris": { lat: 48.8566, lon: 2.3522 },
  "berlin": { lat: 52.5200, lon: 13.4050 },
  "madrid": { lat: 40.4168, lon: -3.7038 },
  "rome": { lat: 41.9028, lon: 12.4964 },
  "lisbon": { lat: 38.7169, lon: -9.1399 },
  "amsterdam": { lat: 52.3676, lon: 4.9041 },
  "warsaw": { lat: 52.2297, lon: 21.0122 },
  "kyiv": { lat: 50.4501, lon: 30.5234 },
  "kyiv, ukraine": { lat: 50.4501, lon: 30.5234 },
  "istanbul": { lat: 41.0082, lon: 28.9784 },
  "barcelona": { lat: 41.3851, lon: 2.1734 },
  // Middle East & Africa
  "cape town": { lat: -33.9249, lon: 18.4241 },
  "cape town, south africa": { lat: -33.9249, lon: 18.4241 },
  "nairobi": { lat: -1.2921, lon: 36.8219 },
  "cairo": { lat: 30.0444, lon: 31.2357 },
  "tel aviv": { lat: 32.0853, lon: 34.7818 },
  "dubai": { lat: 25.2048, lon: 55.2708 },
  // Asia
  "delhi": { lat: 28.6139, lon: 77.2090 },
  "delhi, india": { lat: 28.6139, lon: 77.2090 },
  "mumbai": { lat: 19.0760, lon: 72.8777 },
  "beijing": { lat: 39.9042, lon: 116.4074 },
  "shanghai": { lat: 31.2304, lon: 121.4737 },
  "tokyo": { lat: 35.6762, lon: 139.6503 },
  "singapore": { lat: 1.3521, lon: 103.8198 },
  "jakarta": { lat: -6.2088, lon: 106.8456 },
  "bangkok": { lat: 13.7563, lon: 100.5018 },
  "seoul": { lat: 37.5665, lon: 126.9780 },
  // Oceania
  "sydney": { lat: -33.8688, lon: 151.2093 },
  "sydney, australia": { lat: -33.8688, lon: 151.2093 },
  "melbourne": { lat: -37.8136, lon: 144.9631 },
  "perth": { lat: -31.9505, lon: 115.8605 },
  // Regions / biomes
  "amazon": { lat: -3.4653, lon: -62.2159 },
  "amazon rainforest": { lat: -3.4653, lon: -62.2159 },
  "amazon, brazil": { lat: -3.4653, lon: -62.2159 },
  "california": { lat: 36.7783, lon: -119.4179 },
  "siberia": { lat: 60.0000, lon: 100.0000 },
  "sahara": { lat: 23.4162, lon: 25.6628 },
};

export async function geocode(placeName: string): Promise<Location | null> {
  const key = placeName.toLowerCase().trim();

  // Direct lookup
  const coords = KNOWN_PLACES[key];
  if (coords) {
    return { name: placeName, lat: coords.lat, lon: coords.lon, radiusKm: 150 };
  }

  // Partial match (e.g. "Athens" matches "athens, greece")
  for (const [k, v] of Object.entries(KNOWN_PLACES)) {
    if (k.startsWith(key) || key.startsWith(k.split(",")[0])) {
      return { name: placeName, lat: v.lat, lon: v.lon, radiusKm: 150 };
    }
  }

  // Lat/lon string: "37.8,-122.2" or "37.8 -122.2"
  const coordMatch = key.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return {
      name: placeName,
      lat: parseFloat(coordMatch[1]),
      lon: parseFloat(coordMatch[2]),
      radiusKm: 150,
    };
  }

  // Nominatim fallback for unknown places
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "FireScout Hackathon [contact@example.com]" },
    });
    if (resp.ok) {
      const data = await resp.json() as Array<{ lat: string; lon: string; display_name: string }>;
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
    // Nominatim unavailable
  }

  return null;
}

export function extractLocationFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const place of Object.keys(KNOWN_PLACES)) {
    if (lower.includes(place)) {
      return place.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}
