"use client";

import {useEffect, useRef} from "react";
import {FLIGHT_COMPARISON_COLORS} from "@/lib/flight-comparison";
import {simplifyFlightTrack} from "@/lib/flight-map";

export type GroupReplayFlight = {
  id: string;
  title: string;
  pilotCallsign: string;
  track: Array<{seq: number; lat: number; lon: number; altM?: number}>;
};

const patterns = [undefined, "10 7", "3 7", "14 6 3 6", "18 7"];

function markerIcon(L: typeof import("leaflet"), color: string, label: string) {
  const node = document.createElement("span");
  node.className = "groupReplayMarker";
  node.style.setProperty("--marker-color", color);
  node.textContent = label;
  return L.divIcon({html: node, className: "", iconSize: [30, 30], iconAnchor: [15, 15]});
}

export default function GroupReplayMap({flights, activeIndexes, visibleIds}: {
  flights: GroupReplayFlight[];
  activeIndexes: Record<string, number>;
  visibleIds: string[];
}) {
  const element = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef(new Map<string, import("leaflet").Marker>());
  const activeIndexesRef = useRef(activeIndexes);
  activeIndexesRef.current = activeIndexes;

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!element.current) return;
      const L = await import("leaflet");
      if (cancelled || !element.current) return;
      mapRef.current?.remove();
      markersRef.current.clear();
      const map = L.map(element.current, {zoomControl: true, attributionControl: true});
      mapRef.current = map;
      leafletRef.current = L;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap"}).addTo(map);
      const all: Array<[number, number]> = [];
      flights.forEach((flight, index) => {
        if (!visibleIds.includes(flight.id)) return;
        const track = simplifyFlightTrack(flight.track, 600);
        if (track.length < 2) return;
        const latLngs = track.map((point) => [point.lat, point.lon] as [number, number]);
        all.push(...latLngs);
        const color = FLIGHT_COMPARISON_COLORS[index];
        const path = L.polyline(latLngs, {color, weight: 4, opacity: 0.85, dashArray: patterns[index]}).addTo(map);
        const tooltip = document.createElement("span");
        tooltip.textContent = `${flight.pilotCallsign} · ${flight.title}`;
        path.bindTooltip(tooltip);
        const activeIndex = activeIndexesRef.current[flight.id] ?? -1;
        const point = activeIndex >= 0 ? flight.track[Math.min(activeIndex, flight.track.length - 1)] : flight.track[0];
        const marker = L.marker([point.lat, point.lon], {
          icon: markerIcon(L, color, String(index + 1)),
          opacity: activeIndex >= 0 ? 1 : 0,
          zIndexOffset: 1000
        }).addTo(map);
        marker.bindTooltip(tooltip.cloneNode(true) as HTMLElement);
        markersRef.current.set(flight.id, marker);
      });
      if (all.length) map.fitBounds(L.latLngBounds(all), {padding: [30, 30]});
      else map.setView([51, 10], 5);
      setTimeout(() => map.invalidateSize(), 100);
    }
    build();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current.clear();
    };
  }, [flights, visibleIds]);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    flights.forEach((flight) => {
      const marker = markersRef.current.get(flight.id);
      if (!marker) return;
      const activeIndex = activeIndexes[flight.id] ?? -1;
      if (activeIndex < 0) {
        marker.setOpacity(0);
        return;
      }
      const point = flight.track[Math.min(activeIndex, flight.track.length - 1)];
      if (point) marker.setLatLng([point.lat, point.lon]).setOpacity(1);
    });
  }, [activeIndexes, flights]);

  return <div ref={element} className="comparisonMap" />;
}
