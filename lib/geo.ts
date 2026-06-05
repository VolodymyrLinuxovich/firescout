// Coordinate conversion helpers (approximate flat-earth near the center point)

export function latLonToMeters(
  lat: number, lon: number,
  lat0: number, lon0: number
): { dx: number; dy: number } {
  const dx = (lon - lon0) * Math.cos((lat0 * Math.PI) / 180) * 111320;
  const dy = (lat - lat0) * 110540;
  return { dx, dy };
}

// Rotate a 2D vector by angle (radians) counterclockwise
export function rotateVector(x: number, y: number, angleRad: number): { rx: number; ry: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { rx: cos * x - sin * y, ry: sin * x + cos * y };
}

// Bearing in degrees from point1 to point2
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Haversine distance in km
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Destination point given origin, bearing, and distance
export function destinationPoint(
  lat: number, lon: number, bearingDeg: number, distKm: number
): { lat: number; lon: number } {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distKm / R) +
      Math.cos(lat1) * Math.sin(distKm / R) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distKm / R) * Math.cos(lat1),
      Math.cos(distKm / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}
