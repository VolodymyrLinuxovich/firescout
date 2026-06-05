"use client";
import { useEffect, useRef, useState } from "react";
import type { FireDetection, WindSnapshot, SatelliteLayerConfig, AirQualityObservation } from "@/lib/types";

interface FireScoutMapProps {
  userLat: number;
  userLon: number;
  locationName: string;
  fires?: FireDetection[];
  wind?: WindSnapshot | null;
  plumeGeoJson?: GeoJSON.FeatureCollection | null;
  airQuality?: AirQualityObservation | null;
  satelliteLayer?: SatelliteLayerConfig | null;
  riskLevel?: string;
}

export default function FireScoutMap({
  userLat, userLon, locationName,
  fires = [], wind = null, plumeGeoJson = null,
  airQuality = null, satelliteLayer = null, riskLevel = "WATCH",
}: FireScoutMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const [showSatellite, setShowSatellite] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || leafletMapRef.current) return;

    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted || !mapRef.current) return;

      // Fix Leaflet default icon path in webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!).setView([userLat, userLon], 9);
      leafletMapRef.current = map;

      // Base tile layer
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 18,
      });
      osm.addTo(map);

      // NASA GIBS satellite layer (optional)
      if (satelliteLayer) {
        const nasaTile = L.tileLayer(satelliteLayer.tileUrlTemplate, {
          attribution: satelliteLayer.attribution,
          opacity: satelliteLayer.opacity,
          maxZoom: 9,
          errorTileUrl: "",
        });
        if (showSatellite) nasaTile.addTo(map);
        (map as unknown as Record<string, unknown>)._nasaLayer = nasaTile;
      }

      // User location marker (star)
      const userIcon = L.divIcon({
        html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5))">⭐</div>`,
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([userLat, userLon], { icon: userIcon })
        .bindPopup(`<b>${locationName}</b><br>Your monitored location`)
        .addTo(map);

      // AQI badge near user
      if (airQuality?.aqi != null) {
        const aqiColors: Record<string, string> = {
          Good: "#16a34a", Moderate: "#ca8a04",
          "Unhealthy for Sensitive Groups": "#ea580c",
          Unhealthy: "#dc2626", "Very Unhealthy": "#9333ea", Hazardous: "#7f1d1d",
        };
        const aqiColor = aqiColors[airQuality.category ?? ""] ?? "#ca8a04";
        const aqiIcon = L.divIcon({
          html: `<div style="background:${aqiColor};color:#fff;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">AQI ${airQuality.aqi} · ${airQuality.category}</div>`,
          className: "",
          iconSize: [120, 28],
          iconAnchor: [-10, 0],
        });
        L.marker([userLat + 0.05, userLon + 0.1], { icon: aqiIcon, interactive: false }).addTo(map);
      }

      // NASA FIRMS fire detections
      for (const fire of fires) {
        const conf = typeof fire.confidence === "string" ? fire.confidence.toLowerCase() : "";
        const color = conf === "high" || conf === "h" ? "#ef4444" :
                      conf === "nominal" || conf === "n" ? "#f97316" : "#fbbf24";
        const fireIcon = L.divIcon({
          html: `<div style="width:12px;height:12px;background:${color};border:2px solid #7f1d1d;border-radius:50%;box-shadow:0 0 4px ${color}"></div>`,
          className: "",
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker([fire.lat, fire.lon], { icon: fireIcon })
          .bindPopup(`
            <b>NASA FIRMS Fire Detection</b><br>
            Source: ${fire.source}<br>
            ${fire.frp ? `FRP: ${fire.frp} MW<br>` : ""}
            ${fire.brightness ? `Brightness: ${fire.brightness} K<br>` : ""}
            Confidence: ${fire.confidence}<br>
            ${fire.distanceKm ? `Distance: ${fire.distanceKm.toFixed(0)} km` : ""}
          `)
          .addTo(map);
      }

      // Wind arrow — shows SMOKE TRANSPORT direction (wind FROM + 180)
      if (wind?.windDirectionDeg != null && wind?.windSpeedMps != null) {
        const smokeDir = (wind.windDirectionDeg + 180) % 360;
        const arrowIcon = L.divIcon({
          html: buildWindArrow(smokeDir, wind.windSpeedMps),
          className: "",
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        });
        L.marker([userLat - 0.1, userLon - 0.1], { icon: arrowIcon, interactive: false })
          .bindTooltip(`Wind from ${wind.windDirectionDeg}° · Smoke moves toward ${smokeDir}° · ${wind.windSpeedMps.toFixed(1)} m/s`)
          .addTo(map);
      }

      // Plume heatmap
      if (plumeGeoJson) {
        const features = plumeGeoJson.features as GeoJSON.Feature<GeoJSON.Point, { plumeScore: number }>[];
        for (const feature of features) {
          const score = feature.properties.plumeScore ?? 0;
          if (score < 5) continue;
          const [lon, lat] = feature.geometry.coordinates;
          const radius = 2000 + score * 100;
          const opacity = 0.08 + (score / 100) * 0.35;
          const color = score > 70 ? "#dc2626" : score > 40 ? "#ea580c" : "#f97316";
          L.circle([lat, lon], {
            radius,
            color: "transparent",
            fillColor: color,
            fillOpacity: opacity,
          }).addTo(map);
        }
      }

      setLeafletLoaded(true);
    });

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle satellite layer
  useEffect(() => {
    if (!leafletMapRef.current || !satelliteLayer) return;
    import("leaflet").then((L) => {
      const map = leafletMapRef.current as ReturnType<typeof L.map>;
      const nasaLayer = (map as unknown as Record<string, unknown>)._nasaLayer as ReturnType<typeof L.tileLayer> | undefined;
      if (!nasaLayer) return;
      if (showSatellite) map.addLayer(nasaLayer);
      else map.removeLayer(nasaLayer);
    });
  }, [showSatellite, satelliteLayer]);

  return (
    <div style={{ position: "relative" }}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={mapRef}
        style={{ width: "100%", height: 500, borderRadius: 12, overflow: "hidden", background: "#e8f0e8" }}
      />
      {leafletLoaded && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", gap: 8 }}>
          {satelliteLayer && (
            <button
              onClick={() => setShowSatellite(s => !s)}
              style={{
                background: showSatellite ? "#1d4ed8" : "#fff",
                color: showSatellite ? "#fff" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              }}
            >
              {showSatellite ? "Hide Satellite" : "NASA Satellite"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function buildWindArrow(directionDeg: number, speedMps: number): string {
  const length = Math.min(40 + speedMps * 3, 55);
  const rad = ((directionDeg - 90) * Math.PI) / 180;
  const ex = 30 + Math.cos(rad) * length;
  const ey = 30 + Math.sin(rad) * length;
  return `
    <svg width="60" height="60" style="overflow:visible">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="4" refY="2" orient="auto">
          <path d="M0,0 L0,4 L6,2 z" fill="#7c3aed" />
        </marker>
      </defs>
      <line x1="30" y1="30" x2="${ex}" y2="${ey}"
        stroke="#7c3aed" stroke-width="3" marker-end="url(#ah)" />
      <text x="30" y="14" text-anchor="middle" font-size="9" fill="#7c3aed" font-weight="bold">SMOKE</text>
    </svg>`;
}
