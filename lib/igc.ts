export type TrackPointInput = {
  seq: number;
  time?: Date;
  lat: number;
  lon: number;
  altM: number;
  varioMs?: number;
};

export type ThermalInput = {
  seq: number;
  startTime?: Date;
  endTime?: Date;
  centerLat?: number;
  centerLon?: number;
  avgClimbMs: number;
  maxClimbMs: number;
  gainM: number;
  durationSec: number;
};

export type ParsedIgc = {
  pilot?: string;
  glider?: string;
  registration?: string;
  date?: string;
  startTime?: Date;
  durationSeconds: number;
  distanceKm: number;
  olcPoints: number;
  avgSpeedKmh: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxVarioMs: number;
  points: TrackPointInput[];
  thermals: ThermalInput[];
};

const GLIDER_MAP: Record<string, string> = {
  ASK21: "ASK 21",
  "ASK-21": "ASK 21",
  ASG29: "ASG 29",
  "ASG-29": "ASG 29",
  ASW28: "ASW 28",
  "ASW-28": "ASW 28",
  DISCUS2C: "Discus 2c",
  LS8: "LS8-18",
  "LS-8": "LS8-18",
  DG808: "DG808S",
  "DG-808": "DG808S",
  ARCUS: "Arcus M",
  NIMBUS: "Nimbus 4"
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseIgcLat(raw: string, hemisphere: string): number {
  const deg = Number(raw.slice(0, 2));
  const min = Number(raw.slice(2, 7)) / 1000;
  const val = deg + min / 60;
  return hemisphere === "S" ? -val : val;
}

function parseIgcLon(raw: string, hemisphere: string): number {
  const deg = Number(raw.slice(0, 3));
  const min = Number(raw.slice(3, 8)) / 1000;
  const val = deg + min / 60;
  return hemisphere === "W" ? -val : val;
}

function detectGlider(lines: string[]): string | undefined {
  for (const line of lines) {
    if (/^H[FP]GTY/i.test(line)) {
      const original = line.split(":").slice(1).join(":").trim();
      const normalized = original.toUpperCase().replace(/[\s-]/g, "");
      for (const [key, value] of Object.entries(GLIDER_MAP)) {
        if (normalized.includes(key.replace(/[\s-]/g, ""))) return value;
      }
      return original || undefined;
    }
  }
  return undefined;
}

function parseDate(lines: string[]): { day: number; month: number; year: number } | undefined {
  const h = lines.find((line) => /^HFDTE/i.test(line));
  if (!h) return undefined;
  const m = h.match(/^HFDTE(\d{2})(\d{2})(\d{2})/i);
  if (!m) return undefined;
  const yy = Number(m[3]);
  return { day: Number(m[1]), month: Number(m[2]), year: 2000 + yy };
}

export function parseIgc(text: string): ParsedIgc {
  const lines = text.split(/\r?\n/);
  const date = parseDate(lines);

  let pilot: string | undefined;
  let registration: string | undefined;

  for (const line of lines) {
    if (/^HFPLT/i.test(line)) pilot = line.split(":").slice(1).join(":").trim() || undefined;
    if (/^HFGID/i.test(line)) registration = line.split(":").slice(1).join(":").trim() || undefined;
  }

  const points: TrackPointInput[] = [];
  let previous: TrackPointInput | undefined;
  let totalMeters = 0;

  for (const line of lines) {
    if (!line.startsWith("B") || line.length < 35) continue;

    const hh = Number(line.slice(1, 3));
    const mm = Number(line.slice(3, 5));
    const ss = Number(line.slice(5, 7));
    const lat = parseIgcLat(line.slice(7, 14), line.slice(14, 15));
    const lon = parseIgcLon(line.slice(15, 23), line.slice(23, 24));
    const altM = Number(line.slice(30, 35));

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altM)) continue;

    const time = date ? new Date(Date.UTC(date.year, date.month - 1, date.day, hh, mm, ss)) : undefined;
    const point: TrackPointInput = { seq: points.length, time, lat, lon, altM };

    if (previous) {
      totalMeters += haversine(previous.lat, previous.lon, lat, lon);
      if (previous.time && time) {
        const dt = (time.getTime() - previous.time.getTime()) / 1000;
        if (dt > 0 && dt < 120) point.varioMs = (altM - previous.altM) / dt;
      }
    }

    points.push(point);
    previous = point;
  }

  if (points.length < 2) {
    throw new Error("The IGC file does not contain enough valid B records.");
  }

  const first = points[0];
  const last = points[points.length - 1];
  const durationSeconds =
    first.time && last.time
      ? Math.max(0, Math.round((last.time.getTime() - first.time.getTime()) / 1000))
      : 0;

  const altitudes = points.map((p) => p.altM);
  const varios = points.map((p) => p.varioMs ?? 0);
  const distanceKm = totalMeters / 1000;
  const avgSpeedKmh = durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;
  const olcPoints = distanceKm * 2.5;

  return {
    pilot,
    glider: detectGlider(lines),
    registration,
    date: date ? `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}` : undefined,
    startTime: first.time,
    durationSeconds,
    distanceKm,
    olcPoints,
    avgSpeedKmh,
    maxAltitudeM: Math.max(...altitudes),
    minAltitudeM: Math.min(...altitudes),
    maxVarioMs: Math.max(...varios),
    points,
    thermals: detectThermals(points)
  };
}

function detectThermals(points: TrackPointInput[]): ThermalInput[] {
  const thermals: ThermalInput[] = [];
  let start = -1;

  for (let i = 1; i < points.length; i++) {
    const v = points[i].varioMs ?? 0;
    if (v > 0.6 && start < 0) start = i - 1;
    if ((v <= 0.2 || i === points.length - 1) && start >= 0) {
      const segment = points.slice(start, i + 1);
      const gain = segment[segment.length - 1].altM - segment[0].altM;
      const durationSec =
        segment[0].time && segment[segment.length - 1].time
          ? Math.round((segment[segment.length - 1].time!.getTime() - segment[0].time!.getTime()) / 1000)
          : segment.length;

      if (gain >= 80 && durationSec >= 45) {
        const varioValues = segment.map((p) => p.varioMs ?? 0);
        thermals.push({
          seq: thermals.length + 1,
          startTime: segment[0].time,
          endTime: segment[segment.length - 1].time,
          centerLat: segment.reduce((s, p) => s + p.lat, 0) / segment.length,
          centerLon: segment.reduce((s, p) => s + p.lon, 0) / segment.length,
          avgClimbMs: gain / durationSec,
          maxClimbMs: Math.max(...varioValues),
          gainM: Math.round(gain),
          durationSec
        });
      }
      start = -1;
    }
  }

  return thermals;
}
