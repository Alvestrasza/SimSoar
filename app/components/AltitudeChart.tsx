"use client";

import { useEffect, useRef } from "react";

type Props = {
  profile: number[];
  minAlt: number;
  maxAlt: number;
};

export default function AltitudeChart({ profile, minAlt, maxAlt }: Props) {
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
  }, [profile, minAlt, maxAlt]);

  return <canvas ref={canvasRef} className="altitudeCanvas" />;
}
