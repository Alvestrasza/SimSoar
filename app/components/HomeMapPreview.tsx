"use client";

import { useEffect, useRef, useState } from "react";

type LeafletApi = typeof import("leaflet");

type LocationSource = "browser" | "ip" | "home" | "default";

type MapModePreference = "STANDARD" | "SATELLITE" | "TERRAIN";

type TileLayerConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
};

type PreviewLocation = {
  lat: number;
  lon: number;
  label: string;
  source: LocationSource;
  accuracyM?: number;
};

type Props = {
  homeAirfield?: string | null;
  preferHomeAirfield?: boolean;
};

type MapPreferenceResponse = {
  homeAirfield: string | null;
  preferHomeAirfield: boolean;
  preferredMapMode?: MapModePreference;
};

const DEFAULT_LOCATION: PreviewLocation = {
  lat: 51.1634,
  lon: 10.4477,
  label: "Deutschland",
  source: "default"
};

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

function createMarkerIcon(L: LeafletApi, source: LocationSource) {
  const emoji = source === "home" ? "🛩️" : source === "ip" ? "📍" : source === "browser" ? "📍" : "🗺️";
  const color = source === "home" ? "#1f6feb" : source === "ip" ? "#64748b" : source === "browser" ? "#16a34a" : "#64748b";
  return L.divIcon({
    html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,.25)">${emoji}</div>`,
    className: "simsoar-div-icon",
    iconAnchor: [17, 17]
  });
}

function browserLocation(): Promise<PreviewLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser geolocation is not available."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: Math.round(pos.coords.accuracy),
        label: "Aktueller Standort",
        source: "browser"
      }),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

async function ipLocation(): Promise<PreviewLocation> {
  const response = await fetch("https://ipapi.co/json/", { cache: "no-store" });
  if (!response.ok) throw new Error("IP geolocation lookup failed.");
  const data = await response.json() as { latitude?: number; longitude?: number; city?: string; country_name?: string };
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number") throw new Error("IP geolocation response is incomplete.");

  return {
    lat: data.latitude,
    lon: data.longitude,
    label: "Ungefährer Standort",
    source: "ip"
  };
}

async function homeAirfieldLocation(homeAirfield: string): Promise<PreviewLocation> {
  const query = encodeURIComponent(homeAirfield);
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`, { cache: "force-cache" });
  if (!response.ok) throw new Error("Home airfield geocoding failed.");
  const data = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = data[0];
  if (!first?.lat || !first?.lon) throw new Error("Home airfield was not found.");

  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    label: "Heimatflugplatz",
    source: "home"
  };
}

async function loadMapPreference(): Promise<MapPreferenceResponse> {
  const response = await fetch("/api/me/map-preference", { cache: "no-store" });
  if (!response.ok) throw new Error("Map preference lookup failed.");
  return await response.json() as MapPreferenceResponse;
}

export default function HomeMapPreview({ homeAirfield, preferHomeAirfield = false }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [location, setLocation] = useState<PreviewLocation>(DEFAULT_LOCATION);
  const [mapMode, setMapMode] = useState<MapModePreference>("STANDARD");

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialLocation() {
      try {
        let effectiveHomeAirfield = homeAirfield ?? null;
        let effectivePreferHomeAirfield = preferHomeAirfield;

        try {
          const preference = await loadMapPreference();

          if (!cancelled) {
            setMapMode(preference.preferredMapMode ?? "STANDARD");
          }

          if (preference.homeAirfield) effectiveHomeAirfield = preference.homeAirfield;
          effectivePreferHomeAirfield = preference.preferHomeAirfield;
        } catch {
          // Public home page must not depend on an authenticated profile lookup.
        }

        if (effectivePreferHomeAirfield && effectiveHomeAirfield) {
          try {
            const home = await homeAirfieldLocation(effectiveHomeAirfield);
            if (!cancelled) {
              setLocation(home);
              return;
            }
          } catch {
            // Continue with browser location.
          }
        }

        try {
          const browser = await browserLocation();
          if (!cancelled) {
            setLocation(browser);
          }
          return;
        } catch {
          // Continue with IP fallback.
        }

        try {
          const ip = await ipLocation();
          if (!cancelled) {
            setLocation(ip);
          }
          return;
        } catch {
          if (!cancelled && effectiveHomeAirfield) {
            try {
              const home = await homeAirfieldLocation(effectiveHomeAirfield);
              if (!cancelled) {
                setLocation(home);
              }
              return;
            } catch {
              // Fall through to default location.
            }
          }
        }

        if (!cancelled) {
          setLocation(DEFAULT_LOCATION);
        }
      } catch {
        if (!cancelled) {
          setLocation(DEFAULT_LOCATION);
        }
      }
    }

    resolveInitialLocation();
    return () => { cancelled = true; };
  }, [homeAirfield, preferHomeAirfield]);

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

      const map = L.map(mapEl.current, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false
      });
      mapRef.current = map;
      const tileLayer = tileLayerForMode(mapMode);

      L.tileLayer(tileLayer.url, {
        maxZoom: tileLayer.maxZoom,
        attribution: tileLayer.attribution
      }).addTo(map);

      const latLng = L.latLng(location.lat, location.lon);
      L.marker(latLng, { icon: createMarkerIcon(L, location.source), keyboard: false }).addTo(map);

      if (location.source === "browser" && location.accuracyM && location.accuracyM < 10000) {
        L.circle(latLng, {
          radius: location.accuracyM,
          color: "#16a34a",
          fillColor: "#16a34a",
          fillOpacity: 0.08,
          weight: 1
        }).addTo(map);
      }

      map.setView(latLng, location.source === "ip" || location.source === "default" ? 9 : 13);
      setTimeout(() => map.invalidateSize(), 120);
    }

    buildMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [location, mapMode]);

  return (
    <div className="homeMapPreview" aria-label="SimSoar Standortvorschau">
      <div ref={mapEl} className="homeMap" />
    </div>
  );
}
