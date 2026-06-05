import type { SatelliteLayerConfig } from "../types";

// NASA GIBS WMTS endpoint
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

const LAYER_CONFIGS: Record<string, { layer: string; attribution: string }> = {
  "MODIS_Terra_CorrectedReflectance_TrueColor": {
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    attribution: "Imagery courtesy NASA EOSDIS GIBS / Terra MODIS",
  },
  "VIIRS_SNPP_CorrectedReflectance_TrueColor": {
    layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    attribution: "Imagery courtesy NASA EOSDIS GIBS / Suomi NPP VIIRS",
  },
  "MODIS_Terra_Aerosol": {
    layer: "MODIS_Terra_Aerosol",
    attribution: "MODIS Aerosol Optical Depth courtesy NASA EOSDIS GIBS",
  },
};

const DEFAULT_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";

export function getNasaGibsTileLayer(
  date: string,           // YYYY-MM-DD
  layerPreference?: string
): SatelliteLayerConfig {
  const layerKey = layerPreference && LAYER_CONFIGS[layerPreference]
    ? layerPreference
    : DEFAULT_LAYER;

  const { layer, attribution } = LAYER_CONFIGS[layerKey];

  // NASA GIBS WMTS tile URL template for Leaflet (xyz format)
  const tileUrlTemplate =
    `${GIBS_BASE}/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

  return {
    provider: "NASA_GIBS",
    layerName: layer,
    date,
    attribution,
    tileUrlTemplate,
    type: "xyz",
    opacity: 0.6,
  };
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
