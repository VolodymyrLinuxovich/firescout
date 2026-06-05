"use client";
import dynamic from "next/dynamic";
import MapLegend from "./MapLegend";
import type { MapLayers } from "@/lib/types";

const FireScoutMap = dynamic(() => import("@/components/FireScoutMap"), { ssr: false });

interface MapPageClientProps {
  layers: MapLayers;
  riskLevel: string;
}

export default function MapPageClient({ layers, riskLevel }: MapPageClientProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FireScoutMap
        userLat={layers.userLocation.lat}
        userLon={layers.userLocation.lon}
        locationName={layers.userLocation.name}
        fires={layers.fires ?? []}
        wind={layers.wind ?? null}
        plumeGeoJson={layers.plumeGeoJson ?? null}
        airQuality={layers.aqi ?? null}
        satelliteLayer={layers.satelliteLayer ?? null}
        riskLevel={riskLevel}
      />
      <MapLegend />
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, padding: "8px 0" }}>
        <strong>Data sources:</strong> Air quality from official real-time AirNow measurements (EPA-approved methods). Fire detections from NASA FIRMS MODIS/VIIRS satellite observations. Wind data from NWS. Satellite imagery from NASA GIBS/EOSDIS. Plume layer is an explainable wind-based estimate, not an official atmospheric forecast. <strong>FireScout is decision support, not an emergency authority.</strong> For evacuation or emergency guidance, follow local officials, CAL FIRE, NWS, and emergency alerts.
      </div>
    </div>
  );
}
