// NOAA HRRR-Smoke adapter
// HRRR-Smoke GRIB2 data requires complex parsing (wgrib2, eccodes, or similar).
// For MVP, this adapter is a placeholder. The app functions without it.
//
// Future implementation options:
// 1. Use NOAA OpenDAP/Thredds or a pre-processed endpoint
// 2. Use NCEI archive with GRIB2 libraries (grib2 npm package is limited)
// 3. Use a third-party API that wraps HRRR-Smoke (e.g., AerisWeather, Tomorrow.io)
//
// The plume model layer provides the smoke transport estimate in the MVP.

export async function fetchHrrrSmoke(): Promise<null> {
  console.info("[FireScout] HRRR-Smoke adapter not implemented in MVP. Using Gaussian plume model.");
  return null;
}
