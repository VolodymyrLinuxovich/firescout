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
  compact?: boolean;
}

export default function FireScoutMap({
  userLat, userLon, locationName,
  fires = [], wind = null, plumeGeoJson = null,
  airQuality = null, satelliteLayer = null, riskLevel = "WATCH",
  compact = false,
}: FireScoutMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const [showSatellite, setShowSatellite] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || leafletMapRef.current) return;
    let alive = true;

    import("leaflet").then((L) => {
      if (!alive || !mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: true }).setView([userLat, userLon], 9);
      leafletMapRef.current = map;

      // Dark tactical basemap (CartoDB Dark Matter)
      const darkBase = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '© <a href="https://carto.com">CARTO</a> | © <a href="https://openstreetmap.org">OSM</a>',
          maxZoom: 18,
          subdomains: "abcd",
        }
      );
      darkBase.addTo(map);

      // NASA GIBS satellite layer (optional toggle)
      if (satelliteLayer) {
        const nasaTile = L.tileLayer(satelliteLayer.tileUrlTemplate, {
          attribution: satelliteLayer.attribution,
          opacity: satelliteLayer.opacity,
          maxZoom: 9,
          errorTileUrl: "",
        });
        (map as unknown as Record<string, unknown>)._nasaLayer = nasaTile;
      }

      // Plume heatmap (render first so it's underneath)
      if (plumeGeoJson) {
        const features = plumeGeoJson.features as GeoJSON.Feature<GeoJSON.Point, { plumeScore: number }>[];
        for (const feat of features) {
          const score = feat.properties.plumeScore ?? 0;
          if (score < 5) continue;
          const [lon, lat] = feat.geometry.coordinates;
          const radius = 1800 + score * 120;
          const opacity = 0.06 + (score / 100) * 0.32;
          const color = score > 70 ? "#EF4444" : score > 40 ? "#F97316" : "#FACC15";
          L.circle([lat, lon], { radius, color: "transparent", fillColor: color, fillOpacity: opacity }).addTo(map);
        }
      }

      // NASA FIRMS fire detections
      for (const fire of fires) {
        const conf = typeof fire.confidence === "string" ? fire.confidence.toLowerCase() : "";
        const color = conf === "high" || conf === "h" ? "#EF4444" : conf === "nominal" || conf === "n" ? "#F97316" : "#FACC15";
        const fireIcon = L.divIcon({
          html: `<div style="width:10px;height:10px;background:${color};border:1.5px solid rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 6px ${color}88"></div>`,
          className: "",
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([fire.lat, fire.lon], { icon: fireIcon })
          .bindPopup(`<div style="background:#111;color:#F8FAFC;padding:8px 10px;border-radius:6px;font-size:12px;min-width:160px">
            <b style="color:#F97316">NASA FIRMS Detection</b><br>
            Source: ${fire.source}<br>
            ${fire.frp ? `FRP: <b>${fire.frp}</b> MW<br>` : ""}
            Confidence: ${fire.confidence}<br>
            ${fire.distanceKm ? `Distance: <b>${fire.distanceKm.toFixed(0)} km</b>` : ""}
            <hr style="border-color:#263241;margin:4px 0">
            <small style="color:#94A3B8">Thermal anomaly detection.<br>Not a fire perimeter.</small>
          </div>`, { className: "firescout-popup" })
          .addTo(map);
      }

      // User location marker
      const userIcon = L.divIcon({
        html: `<div style="position:relative">
          <div style="width:18px;height:18px;background:#38BDF8;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(56,189,248,0.25)"></div>
          <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(7,10,15,0.9);color:#38BDF8;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #263241">${locationName}</div>
        </div>`,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([userLat, userLon], { icon: userIcon })
        .bindPopup(`<b style="color:#38BDF8">${locationName}</b><br>Monitored location`)
        .addTo(map);

      // AQI badge overlay
      if (airQuality?.aqi != null) {
        const aqiColors: Record<string, string> = {
          "Good": "#22C55E", "Moderate": "#FACC15",
          "Unhealthy for Sensitive Groups": "#F97316",
          "Unhealthy": "#EF4444", "Very Unhealthy": "#A855F7", "Hazardous": "#7F1D1D",
        };
        const c = aqiColors[airQuality.category ?? ""] ?? "#F97316";
        const aqiIcon = L.divIcon({
          html: `<div style="background:rgba(7,10,15,0.9);border:1px solid ${c};color:${c};padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap">AQI ${airQuality.aqi} · ${airQuality.category}</div>`,
          className: "",
          iconSize: [140, 26],
          iconAnchor: [-8, 0],
        });
        L.marker([userLat + 0.04, userLon + 0.08], { icon: aqiIcon, interactive: false }).addTo(map);
      }

      // Wind / smoke transport arrow
      if (wind?.windDirectionDeg != null && wind?.windSpeedMps != null) {
        const smokeDir = (wind.windDirectionDeg + 180) % 360;
        const arrowIcon = L.divIcon({
          html: buildWindArrow(smokeDir, wind.windSpeedMps),
          className: "",
          iconSize: [80, 80],
          iconAnchor: [40, 40],
        });
        L.marker([userLat - 0.08, userLon - 0.05], { icon: arrowIcon, interactive: true })
          .bindTooltip(`<b>Smoke transport</b><br>Wind FROM ${wind.windDirectionDeg}° at ${wind.windSpeedMps.toFixed(1)} m/s<br>Smoke moving TOWARD ${smokeDir}°<br><small>NWS wind data</small>`)
          .addTo(map);
      }

      setReady(true);
    });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle satellite
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

  const height = compact ? 380 : 520;

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #263241" }}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ width: "100%", height, background: "#070A0F" }} />

      {/* Map overlay labels */}
      {ready && (
        <>
          <div style={{ position: "absolute", bottom: 36, left: 8, zIndex: 900, display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              airQuality ? { label: `Measured AQI: AirNow`, color: "#38BDF8" } : null,
              fires.length ? { label: `${fires.length} satellite fire detection${fires.length !== 1 ? "s" : ""}: NASA FIRMS`, color: "#F97316" } : null,
              wind ? { label: `Wind: NWS`, color: "#94A3B8" } : null,
              plumeGeoJson ? { label: `Plume: FireScout Gaussian model`, color: "#A78BFA" } : null,
            ].filter(Boolean).map((item) => (
              <div key={item!.label} style={{ background: "rgba(7,10,15,0.85)", border: `1px solid ${item!.color}44`, borderRadius: 4, padding: "2px 7px", fontSize: 10, color: item!.color, fontWeight: 600 }}>
                {item!.label}
              </div>
            ))}
          </div>

          <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 900, background: "rgba(7,10,15,0.85)", border: "1px solid #EF444444", borderRadius: 4, padding: "2px 7px", fontSize: 9, color: "#EF4444", fontWeight: 600 }}>
            DECISION SUPPORT ONLY · NOT AN EMERGENCY AUTHORITY
          </div>

          {satelliteLayer && (
            <button
              onClick={() => setShowSatellite(s => !s)}
              style={{ position: "absolute", top: 8, right: 8, zIndex: 1000, background: showSatellite ? "#1D4ED8" : "rgba(7,10,15,0.9)", color: showSatellite ? "#fff" : "#94A3B8", border: "1px solid #263241", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              {showSatellite ? "HIDE SAT" : "NASA SAT"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function buildWindArrow(directionDeg: number, speedMps: number): string {
  const len = Math.min(32 + speedMps * 2.5, 44);
  const rad = ((directionDeg - 90) * Math.PI) / 180;
  const ex = 40 + Math.cos(rad) * len;
  const ey = 40 + Math.sin(rad) * len;
  return `<svg width="80" height="80" style="overflow:visible">
    <defs>
      <marker id="wah" markerWidth="7" markerHeight="7" refX="3.5" refY="1.75" orient="auto">
        <path d="M0,0 L0,3.5 L5,1.75 z" fill="#A78BFA"/>
      </marker>
    </defs>
    <circle cx="40" cy="40" r="3" fill="#A78BFA" opacity="0.8"/>
    <line x1="40" y1="40" x2="${ex}" y2="${ey}" stroke="#A78BFA" stroke-width="2.5" marker-end="url(#wah)" opacity="0.9"/>
    <text x="40" y="${ey + 12}" text-anchor="middle" font-size="8" fill="#A78BFA" font-weight="700">SMOKE</text>
  </svg>`;
}
