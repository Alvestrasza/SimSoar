"use client";

import { useEffect, useRef } from "react";

type Props = {
  profile: number[];
  pointSequences?: number[];
  thermalRanges?: Array<{startSeq?: number | null; endSeq?: number | null}>;
  minAlt: number;
  maxAlt: number;
  activeIndex?: number;
  activeThermal?: boolean;
};

export default function AltitudeChart({profile, pointSequences = [], thermalRanges = [], minAlt, maxAlt, activeIndex = -1, activeThermal = false}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || profile.length < 2) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 720));
    const height = 180;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, width, height);

    const pad = 12;
    const range = maxAlt - minAlt || 1;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(31,111,235,.18)");
    gradient.addColorStop(1, "rgba(31,111,235,.02)");

    const point = (alt: number, index: number) => ({
      x: pad + (index / (profile.length - 1)) * (width - pad * 2),
      y: height - pad - ((alt - minAlt) / range) * (height - pad * 2)
    });

    ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
    for (const thermal of thermalRanges) {
      if (thermal.startSeq == null || thermal.endSeq == null || pointSequences.length !== profile.length) continue;
      const startIndex = pointSequences.findIndex((seq) => seq >= thermal.startSeq!);
      let endIndex = pointSequences.length - 1;
      while (endIndex >= 0 && pointSequences[endIndex] > thermal.endSeq) endIndex -= 1;
      if (startIndex < 0) continue;
      if (endIndex < startIndex) endIndex = startIndex;
      const startX = point(profile[startIndex], startIndex).x;
      const endX = point(profile[endIndex], endIndex).x;
      ctx.fillRect(startX, pad, Math.max(3, endX - startX), height - pad * 2);
    }

    ctx.beginPath();
    profile.forEach((alt, index) => {
      const p = point(alt, index);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(width - pad, height - pad);
    ctx.lineTo(pad, height - pad);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    profile.forEach((alt, index) => {
      const p = point(alt, index);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.fillStyle = "#7d8797";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText(`${maxAlt} m`, pad + 4, 16);
    ctx.fillText(`${minAlt} m`, pad + 4, height - 4);

    if (activeIndex >= 0 && activeIndex < profile.length) {
      const activePoint = point(profile[activeIndex], activeIndex);
      ctx.beginPath();
      ctx.moveTo(activePoint.x, pad);
      ctx.lineTo(activePoint.x, height - pad);
      ctx.strokeStyle = activeThermal ? "#f59e0b" : "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(activePoint.x, activePoint.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = activeThermal ? "#f59e0b" : "#2563eb";
      ctx.fill();
    }
  }, [profile, pointSequences, thermalRanges, minAlt, maxAlt, activeIndex, activeThermal]);

  return <canvas ref={canvasRef} className="altitudeCanvas" />;
}
