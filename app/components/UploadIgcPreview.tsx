"use client";

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";

type Preview = {
  pilot?: string;
  glider?: string;
  date?: string;
  distanceKm: number;
  durationSeconds: number;
  avgSpeedKmh: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxVarioMs: number;
  points: {altM: number}[];
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseLat(raw: string, h: string) {
  const deg = Number(raw.slice(0, 2));
  const min = Number(raw.slice(2, 7)) / 1000;

  return (deg + min / 60) * (h === "S" ? -1 : 1);
}

function parseLon(raw: string, h: string) {
  const deg = Number(raw.slice(0, 3));
  const min = Number(raw.slice(3, 8)) / 1000;

  return (deg + min / 60) * (h === "W" ? -1 : 1);
}

function parsePreview(text: string): Preview | null {
  const lines = text.split(/\r?\n/);
  const points: {t: number; lat: number; lon: number; altM: number}[] = [];

  let pilot = "";
  let glider = "";
  let date = "";

  for (const line of lines) {
    if (/^HFPLT/i.test(line)) {
      pilot = line.split(":").slice(1).join(":").trim();
    }

    if (/^H[FP]GTY/i.test(line)) {
      glider = line.split(":").slice(1).join(":").trim();
    }

    const dm = line.match(/^HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/i);

    if (dm) {
      date = `20${dm[3]}-${dm[2]}-${dm[1]}`;
    }

    if (!line.startsWith("B") || line.length < 35) {
      continue;
    }

    const valid = line[24];

    if (valid !== "A" && valid !== "V") {
      continue;
    }

    const hh = Number(line.slice(1, 3));
    const mm = Number(line.slice(3, 5));
    const ss = Number(line.slice(5, 7));
    const lat = parseLat(line.slice(7, 14), line.slice(14, 15));
    const lon = parseLon(line.slice(15, 23), line.slice(23, 24));
    const pressureAlt = Number(line.slice(25, 30));
    const gpsAlt = Number(line.slice(30, 35));

    const altM =
      Number.isFinite(pressureAlt) && pressureAlt !== 0
        ? pressureAlt
        : gpsAlt;

    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altM)) {
      points.push({
        t: hh * 3600 + mm * 60 + ss,
        lat,
        lon,
        altM
      });
    }
  }

  if (points.length < 2) {
    return null;
  }

  let meters = 0;
  let maxVario = 0;

  for (let i = 1; i < points.length; i++) {
    meters += haversine(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );

    const dtRaw = points[i].t - points[i - 1].t;
    const dt = dtRaw < 0 ? dtRaw + 86400 : dtRaw;

    if (dt > 0 && dt <= 30) {
      maxVario = Math.max(
        maxVario,
        (points[i].altM - points[i - 1].altM) / dt
      );
    }
  }

  let durationSeconds = points[points.length - 1].t - points[0].t;

  if (durationSeconds < 0) {
    durationSeconds += 86400;
  }

  const alts = points.map((p) => p.altM).filter((a) => a > 0);
  const distanceKm = meters / 1000;

  return {
    pilot,
    glider,
    date,
    distanceKm,
    durationSeconds,
    avgSpeedKmh:
      durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0,
    maxAltitudeM: Math.max(...alts),
    minAltitudeM: Math.min(...alts),
    maxVarioMs: maxVario,
    points
  };
}

function durationLabel(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  return `${h}h ${m}min`;
}

export default function UploadIgcPreview() {
  const t = useTranslations("Upload");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!preview || preview.points.length < 2 || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const width = Math.max(
      320,
      Math.floor(canvas.getBoundingClientRect().width || 700)
    );

    const height = 90;
    const scale = window.devicePixelRatio || 1;

    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, width, height);

    const step = Math.max(1, Math.floor(preview.points.length / 90));

    const profile = preview.points
      .filter((_, index) => index % step === 0)
      .map((p) => p.altM);

    const min = preview.minAltitudeM;
    const max = preview.maxAltitudeM;
    const range = max - min || 1;
    const pad = 5;

    ctx.beginPath();

    profile.forEach((alt, index) => {
      const x = pad + (index / (profile.length - 1)) * (width - pad * 2);
      const y = height - pad - ((alt - min) / range) * (height - pad * 2);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [preview]);

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    setFileInfo({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`
    });

    const text = await file.text();
    const parsed = parsePreview(text);

    setPreview(parsed);

    if (parsed?.pilot) {
      const pilotInput = document.querySelector<HTMLInputElement>(
        'input[name="pilotCallsign"]'
      );

      if (pilotInput && !pilotInput.value) {
        pilotInput.value = parsed.pilot;
      }
    }

    if (parsed?.glider) {
      const gliderInput = document.querySelector<HTMLInputElement>(
        'input[name="glider"]'
      );

      if (gliderInput && !gliderInput.value) {
        gliderInput.value = parsed.glider;
      }
    }
  }

  return (
    <div className="uploadPreview">
      <div className="dropZone">
        <div style={{fontSize: 44}}>📁</div>

        <strong>{t("dropTitle")}</strong>

        <p className="muted">
          {t("dropSub")}
        </p>

        <input
          name="igc"
          type="file"
          accept=".igc"
          required
          onChange={(event) =>
            handleFile(event.target.files?.[0] ?? null)
          }
        />
      </div>

      {fileInfo ? (
        <div className="fileOk">
          <strong>{fileInfo.name}</strong>
          <span className="muted">{fileInfo.size}</span>
        </div>
      ) : null}

      {preview ? (
        <div className="parsedBox">
          <strong>{t("detectedTitle")}</strong>

          <div>
            <span>{t("pilot")}</span>
            <b>{preview.pilot || "–"}</b>
          </div>

          <div>
            <span>{t("glider")}</span>
            <b>{preview.glider || "–"}</b>
          </div>

          <div>
            <span>{t("date")}</span>
            <b>{preview.date || "–"}</b>
          </div>

          <div>
            <span>{t("distance")}</span>
            <b>{preview.distanceKm.toFixed(1)} km</b>
          </div>

          <div>
            <span>{t("duration")}</span>
            <b>{durationLabel(preview.durationSeconds)}</b>
          </div>

          <div>
            <span>{t("avgSpeed")}</span>
            <b>{preview.avgSpeedKmh.toFixed(1)} km/h</b>
          </div>

          <div>
            <span>{t("maxAltitude")}</span>
            <b>{preview.maxAltitudeM} m</b>
          </div>

          <div>
            <span>{t("maxVario")}</span>
            <b>+{preview.maxVarioMs.toFixed(1)} m/s</b>
          </div>

          <canvas ref={canvasRef} className="uploadAltCanvas" />
        </div>
      ) : fileInfo ? (
        <div className="parsedBox warn">
          {t("noValidRecords")}
        </div>
      ) : null}
    </div>
  );
}