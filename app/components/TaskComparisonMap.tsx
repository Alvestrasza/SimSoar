"use client";

import {useEffect, useRef} from "react";
import type {TaskPoint} from "@/lib/task-planner";

export default function TaskComparisonMap({task, track = []}: {task: TaskPoint[]; track?: Array<{lat: number; lon: number}>}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    void import("leaflet").then((L) => {
      if (disposed || !mapEl.current) return;
      map = L.map(mapEl.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap"}).addTo(map);
      const planned = task.map((point) => L.latLng(point.lat, point.lon));
      L.polyline(planned, {color: "#1f6feb", weight: 4, dashArray: "8 6"}).addTo(map);
      task.forEach((point, index) => L.circle([point.lat, point.lon], {radius: point.radiusM ?? 500, color: "#1f6feb", fillOpacity: 0.08}).addTo(map!).bindTooltip(`${index + 1}. ${point.name || point.code || "Waypoint"}`));
      if (track.length > 1) L.polyline(track.map((point) => [point.lat, point.lon]), {color: "#ea580c", weight: 3, opacity: 0.85}).addTo(map);
      const bounds = [...planned, ...track.map((point) => L.latLng(point.lat, point.lon))];
      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), {padding: [30, 30]}); else map.setView([51, 10], 5);
      setTimeout(() => map?.invalidateSize(), 50);
    });
    return () => { disposed = true; map?.remove(); };
  }, [task, track]);
  return <div ref={mapEl} className="taskComparisonMap" />;
}
