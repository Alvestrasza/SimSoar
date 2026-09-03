"use client";

import {useEffect, useRef} from "react";
import {useRouter} from "@/i18n/navigation";
import {
  flightTrackEndpoints,
  simplifyFlightTrack,
  type FlightMapPoint
} from "@/lib/flight-map";

type LeafletApi = typeof import("leaflet");

type OverviewFlight = {
  id: string;
  title: string;
  pilotCallsign: string;
  track: FlightMapPoint[];
};

type Props = {
  flights: OverviewFlight[];
  highlightedFlightId: string | null;
  startLabel: string;
  finishLabel: string;
};

function markerIcon(L: LeafletApi, label: string, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.3)">${label}</div>`,
    className: "simsoar-div-icon",
    iconAnchor: [13, 13]
  });
}

function popupContent(
  flight: OverviewFlight,
  pointLabel: string
): HTMLDivElement {
  const wrapper = document.createElement("div");
  const title = document.createElement("strong");
  const detail = document.createElement("div");

  title.textContent = flight.pilotCallsign;
  detail.textContent = `${pointLabel} · ${flight.title}`;
  wrapper.append(title, detail);
  return wrapper;
}

export default function FlightsOverviewMap({
  flights,
  highlightedFlightId,
  startLabel,
  finishLabel
}: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const pathsRef = useRef(new Map<string, import("leaflet").Polyline>());
  const highlightedFlightIdRef = useRef(highlightedFlightId);
  const router = useRouter();

  useEffect(() => {
    highlightedFlightIdRef.current = highlightedFlightId;

    for (const [flightId, path] of pathsRef.current) {
      const highlighted = flightId === highlightedFlightId;
      path.setStyle({
        color: highlighted ? "#ea580c" : "#1f6feb",
        weight: highlighted ? 6 : 3,
        opacity: highlighted ? 1 : 0.55
      });
    }
  }, [highlightedFlightId]);

  useEffect(() => {
    let cancelled = false;

    async function buildMap() {
      if (!mapElement.current) return;

      const L = await import("leaflet");
      if (cancelled || !mapElement.current) return;

      mapRef.current?.remove();
      pathsRef.current.clear();

      const map = L.map(mapElement.current, {
        zoomControl: true,
        attributionControl: true
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
      }).addTo(map);

      const allPoints: Array<[number, number]> = [];

      for (const flight of flights) {
        const track = simplifyFlightTrack(flight.track, 120);
        const endpoints = flightTrackEndpoints(track);

        if (!endpoints) continue;

        const latLngs = track.map(
          (point) => [point.lat, point.lon] as [number, number]
        );
        allPoints.push(...latLngs);

        const highlighted = flight.id === highlightedFlightIdRef.current;
        const path = L.polyline(latLngs, {
          color: highlighted ? "#ea580c" : "#1f6feb",
          weight: highlighted ? 6 : 3,
          opacity: highlighted ? 1 : 0.55
        }).addTo(map);
        pathsRef.current.set(flight.id, path);

        path.on("click", () => router.push(`/flights/${flight.id}`));

        const startMarker = L.marker(
          [endpoints.start.lat, endpoints.start.lon],
          {icon: markerIcon(L, "S", highlighted ? "#ea580c" : "#16a34a")}
        ).addTo(map);
        startMarker.bindPopup(popupContent(flight, startLabel));
        startMarker.on("click", () => router.push(`/flights/${flight.id}`));

        const finishMarker = L.marker(
          [endpoints.finish.lat, endpoints.finish.lon],
          {icon: markerIcon(L, "L", highlighted ? "#ea580c" : "#dc2626")}
        ).addTo(map);
        finishMarker.bindPopup(popupContent(flight, finishLabel));
        finishMarker.on("click", () => router.push(`/flights/${flight.id}`));
      }

      if (allPoints.length > 0) {
        map.fitBounds(L.latLngBounds(allPoints), {padding: [30, 30]});
      } else {
        map.setView([51, 10], 5);
      }

      setTimeout(() => map.invalidateSize(), 100);
    }

    buildMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pathsRef.current.clear();
    };
  }, [finishLabel, flights, router, startLabel]);

  return <div ref={mapElement} className="flightsOverviewMap" />;
}
