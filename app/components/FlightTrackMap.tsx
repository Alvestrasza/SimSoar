"use client";

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";

type LeafletApi = typeof import("leaflet");

type TrackPoint = {
  lat: number;
  lon: number;
  altM: number;
  varioMs?: number | null;
};

type Thermal = {
  seq: number;
  centerLat?: number | null;
  centerLon?: number | null;
  avgClimbMs: number;
  gainM: number;
  durationSec: number;
};

type Airspace = {
  id: string;
  name: string;
  className: string;
  floorLabel: string;
  ceilingLabel: string;
  points: Array<{lat: number; lon: number}>;
};

type MapModePreference = "STANDARD" | "SATELLITE" | "TERRAIN";

type TileLayerConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
};

type Props = {
  points: TrackPoint[];
  thermals?: Thermal[];
  airspaces?: Airspace[];
  active?: boolean;
  mapMode?: MapModePreference;
};

function mkIcon(L: LeafletApi, label: string, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.25)">${label}</div>`,
    className: "simsoar-div-icon",
    iconAnchor: [15, 15]
  });
}

function altitudeColor(alt: number, minAlt: number, maxAlt: number) {
  const range = maxAlt - minAlt || 1;
  const t = Math.max(0, Math.min(1, (alt - minAlt) / range));
  const r = Math.round(255 * t);
  const g = Math.round(165 * (1 - Math.abs(t - 0.5) * 2));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

function tileLayerForMode(mapMode: MapModePreference): TileLayerConfig {
  if (mapMode === "SATELLITE") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles © Esri",
      maxZoom: 19
    };
  }

  if (mapMode === "TERRAIN") {
    return {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "© OpenTopoMap contributors",
      maxZoom: 17
    };
  }

  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 18
  };
}

function nextMapMode(mapMode: MapModePreference): MapModePreference {
  if (mapMode === "STANDARD") return "SATELLITE";
  if (mapMode === "SATELLITE") return "TERRAIN";
  return "STANDARD";
}

function mapModeLabel(mapMode: MapModePreference) {
  if (mapMode === "SATELLITE") return "🛰️ Satellite";
  if (mapMode === "TERRAIN") return "⛰️ Terrain";
  return "🗺️ Standard";
}

export default function FlightTrackMap({
  points,
  thermals = [],
  airspaces = [],
  active = true,
  mapMode = "STANDARD"
}: Props) {
  const t = useTranslations("FlightDetail");
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  const [currentMapMode, setCurrentMapMode] = useState<MapModePreference>(mapMode);
  const [showAirspaces, setShowAirspaces] = useState(false);

  useEffect(() => {
    setCurrentMapMode(mapMode);
  }, [mapMode]);

  useEffect(() => {
    let cancelled = false;

    async function buildMap() {
      if (!mapEl.current) return;
      const leafletModule = await import("leaflet");
      if (cancelled || !mapEl.current) return;
      const L = leafletModule;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;

      const tileLayer = tileLayerForMode(currentMapMode);

      L.tileLayer(tileLayer.url, {
        maxZoom: tileLayer.maxZoom,
        attribution: tileLayer.attribution
      }).addTo(map);

      if (showAirspaces) {
        for (const airspace of airspaces) {
          if (airspace.points.length < 3) continue;
          const polygon = L.polygon(
            airspace.points.map((point) => [point.lat, point.lon] as [number, number]),
            {color: "#dc2626", weight: 2, opacity: 0.8, fillColor: "#ef4444", fillOpacity: 0.12}
          ).addTo(map);
          const tooltip = document.createElement("span");
          tooltip.textContent = `${airspace.name} · ${airspace.className} · ${airspace.floorLabel} – ${airspace.ceilingLabel}`;
          polygon.bindTooltip(tooltip);
        }
      }

      if (points.length > 1) {
        const latLngs = points.map((p) => L.latLng(p.lat, p.lon));
        const alts = points.map((p) => p.altM).filter((a) => Number.isFinite(a));
        const minAlt = Math.min(...alts);
        const maxAlt = Math.max(...alts);
        const stride = Math.max(1, Math.floor(points.length / 400));

        for (let i = stride; i < points.length; i += stride) {
          const prev = points[Math.max(0, i - stride)];
          const curr = points[i];
          L.polyline(
            [[prev.lat, prev.lon], [curr.lat, curr.lon]],
            { color: altitudeColor(curr.altM, minAlt, maxAlt), weight: 3, opacity: 0.9 }
          ).addTo(map);
        }

        L.marker(latLngs[0], { icon: mkIcon(L, "🛫", "#16a34a") }).addTo(map).bindPopup("Start");
        L.marker(latLngs[latLngs.length - 1], { icon: mkIcon(L, "🛬", "#dc2626") }).addTo(map).bindPopup("Landung");

        thermals.forEach((thermal) => {
          if (thermal.centerLat == null || thermal.centerLon == null) return;
          const color = thermal.avgClimbMs > 2.5 ? "#16a34a" : thermal.avgClimbMs > 1.2 ? "#ea580c" : "#7d8797";
          const icon = L.divIcon({
            html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.25)">+${thermal.avgClimbMs.toFixed(1)}</div>`,
            className: "simsoar-div-icon",
            iconAnchor: [15, 15]
          });
          L.marker([thermal.centerLat, thermal.centerLon], { icon })
            .addTo(map)
            .bindPopup(`Thermik #${thermal.seq}: +${thermal.avgClimbMs.toFixed(1)} m/s, +${thermal.gainM} m, ${thermal.durationSec}s`);
        });

        map.fitBounds(L.latLngBounds(latLngs), { padding: [30, 30] });
      } else {
        map.setView([51.0, 10.0], 5);
      }

      setTimeout(() => map.invalidateSize(), 100);
    }

    buildMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points, thermals, airspaces, currentMapMode, showAirspaces]);

  useEffect(() => {
    if (active && mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 80);
  }, [active]);

  return (
    <div className="flightMapShell">
      <div className="mapControls">
        {airspaces.length > 0 ? <button
          className="mapModeToggle"
          type="button"
          onClick={() => setShowAirspaces((value) => !value)}
          aria-pressed={showAirspaces}
        >
          {showAirspaces ? t("hideAirspaces") : t("showAirspaces")}
        </button> : null}
        <button
          className="mapModeToggle"
          type="button"
          onClick={() => setCurrentMapMode((value) => nextMapMode(value))}
          title="Switch map mode"
          aria-label="Switch map mode"
        >
          {mapModeLabel(currentMapMode)}
        </button>
      </div>

      <div ref={mapEl} className="leafletMap" />
    </div>
  );
}
