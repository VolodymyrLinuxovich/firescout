"use client";
import dynamic from "next/dynamic";
import type { MapLayers } from "@/lib/types";

const FireScoutMap = dynamic(() => import("@/components/FireScoutMap"), { ssr: false });

interface MapPageClientProps {
  layers: MapLayers;
  riskLevel: string;
  compact?: boolean;
}

export default function MapPageClient({ layers, riskLevel, compact }: MapPageClientProps) {
  return (
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
      compact={compact}
    />
  );
}
