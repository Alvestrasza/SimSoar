"use client";

import {useEffect, useRef} from "react";
import {FLIGHT_COMPARISON_COLORS} from "@/lib/flight-comparison";

type Flight = {id: string; track: Array<{altM?: number}>};

export default function FlightComparisonAltitudeChart({flights}: {flights: Flight[]}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const profiles = flights.map((flight) => flight.track.map((point) => point.altM).filter((alt): alt is number => Number.isFinite(alt)));
    const values = profiles.flat(); if (values.length < 2) return;
    const rect = canvas.getBoundingClientRect(); const width = Math.max(320, Math.floor(rect.width || 720)); const height = 240; const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale; canvas.height = height * scale; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.scale(scale, scale); ctx.clearRect(0, 0, width, height);
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1; const pad = 18;
    profiles.forEach((profile, flightIndex) => {
      if (profile.length < 2) return; ctx.beginPath();
      profile.forEach((altitude, index) => {
        const x = pad + index / (profile.length - 1) * (width - pad * 2); const y = height - pad - (altitude - min) / range * (height - pad * 2);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = FLIGHT_COMPARISON_COLORS[flightIndex]; ctx.lineWidth = 2.5; ctx.setLineDash(flightIndex === 1 ? [10, 7] : flightIndex === 2 ? [3, 7] : flightIndex === 3 ? [14, 6, 3, 6] : flightIndex === 4 ? [18, 7] : []); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.fillStyle = "#7d8797"; ctx.font = "11px Inter, sans-serif"; ctx.fillText(`${max} m`, pad + 4, 14); ctx.fillText(`${min} m`, pad + 4, height - 4);
  }, [flights]);
  return <canvas ref={canvasRef} className="comparisonAltitudeChart" />;
}
