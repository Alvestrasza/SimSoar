"use client";

import {useEffect, useRef} from "react";
import {FLIGHT_COMPARISON_COLORS} from "@/lib/flight-comparison";
import {simplifyFlightTrack, type FlightMapPoint} from "@/lib/flight-map";

type Flight = {id: string; title: string; pilotCallsign: string; track: FlightMapPoint[]};
const patterns = [undefined, "10 7", "3 7", "14 6 3 6", "18 7"];

export default function FlightComparisonMap({flights}: {flights: Flight[]}) {
  const element = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!element.current) return;
      const L = await import("leaflet"); if (cancelled || !element.current) return;
      mapRef.current?.remove();
      const map = L.map(element.current, {zoomControl: true, attributionControl: true}); mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap"}).addTo(map);
      const all: Array<[number, number]> = [];
      flights.forEach((flight, index) => {
        const track = simplifyFlightTrack(flight.track, 600); if (track.length < 2) return;
        const latLngs = track.map((point) => [point.lat, point.lon] as [number, number]); all.push(...latLngs);
        const path = L.polyline(latLngs, {color: FLIGHT_COMPARISON_COLORS[index], weight: 4, opacity: 0.9, dashArray: patterns[index]}).addTo(map);
        const tooltip = document.createElement("span"); tooltip.textContent = `${flight.pilotCallsign} · ${flight.title}`; path.bindTooltip(tooltip);
      });
      if (all.length) map.fitBounds(L.latLngBounds(all), {padding: [30, 30]}); else map.setView([51, 10], 5);
      setTimeout(() => map.invalidateSize(), 100);
    }
    build();
    return () => {cancelled = true; mapRef.current?.remove(); mapRef.current = null;};
  }, [flights]);
  return <div ref={element} className="comparisonMap" />;
}
