import {calculateScore, type ScoringResult} from "./scoring.ts";
import {detectScoringWindow, type DetectedScoringWindow} from "./scoring-window.ts";

export type TrackPointInput = {
  seq: number;
  time?: Date;
  secondsOfDay: number;
  lat: number;
  lon: number;
  altM: number;
  varioMs?: number;
};

export type ThermalInput = {
  seq: number;
  startSeq: number;
  endSeq: number;
  startTime?: Date;
  endTime?: Date;
  centerLat?: number;
  centerLon?: number;
  avgClimbMs: number;
  maxClimbMs: number;
  gainM: number;
  durationSec: number;
  efficiencyPercent: number;
};

export type GlidePhaseInput = {
  seq: number;
  startSeq: number;
  endSeq: number;
  startTime?: Date;
  endTime?: Date;
  durationSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  avgSinkMs: number;
  glideRatio: number;
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
  scoring: ScoringResult;
  scoringWindow: DetectedScoringWindow;
  avgSpeedKmh: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxVarioMs: number;
  points: TrackPointInput[];
  thermals: ThermalInput[];
  glidePhases: GlidePhaseInput[];
};

const GLIDER_MAP: Record<string, string> = {
  ASK21: "ASK 21",
  "ASK-21": "ASK 21",
  "ASK 21": "ASK 21",
  ASK13: "ASK 13",
  ASG29: "ASG 29",
  "ASG-29": "ASG 29",
  "ASG 29": "ASG 29",
  ASW28: "ASW 28",
  "ASW-28": "ASW 28",
  ASW28E: "ASW 28e",
  AS33: "AS 33 Me",
  "AS-33": "AS 33 Me",
  DISCUS2C: "Discus 2c",
  "DISCUS-2C": "Discus 2c",
  DISCUS2: "Discus 2c",
  VENTUS3: "Ventus 3",
  "VENTUS-3": "Ventus 3",
  VENTUS2: "Ventus 2",
  LS8: "LS8-18",
  "LS-8": "LS8-18",
  LS4: "LS4",
  "LS-4": "LS4",
  DG808: "DG808S",
  "DG-808": "DG808S",
  DG1000: "DG-1000",
  ARCUS: "Arcus M",
  NIMBUS: "Nimbus 4",
  BLANIK: "Blaník L-13",
  SG38: "SG 38",
  KA6: "Ka-6",
  "KA-6": "Ka-6",
  PIK20: "PIK-20",
  "PIK-20": "PIK-20"
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
  const line = lines.find((candidate) => /^HFDTE/i.test(candidate));
  if (!line) return undefined;

  const match = line.match(/^HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/i);
  if (!match) return undefined;

  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: 2000 + Number(match[3])
  };
}

function secondsDelta(current: number, previous: number): number {
  const delta = current - previous;
  return delta < 0 ? delta + 86400 : delta;
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

    const validFlag = line.slice(24, 25);
    if (validFlag !== "A" && validFlag !== "V") continue;

    const hh = Number(line.slice(1, 3));
    const mm = Number(line.slice(3, 5));
    const ss = Number(line.slice(5, 7));
    const secondsOfDay = hh * 3600 + mm * 60 + ss;
    const lat = parseIgcLat(line.slice(7, 14), line.slice(14, 15));
    const lon = parseIgcLon(line.slice(15, 23), line.slice(23, 24));
    const pressureAlt = Number(line.slice(25, 30));
    const gpsAlt = Number(line.slice(30, 35));
    const altM = Number.isFinite(pressureAlt) && pressureAlt !== 0 ? pressureAlt : gpsAlt;

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altM) || !Number.isFinite(secondsOfDay)) continue;

    const time = date ? new Date(Date.UTC(date.year, date.month - 1, date.day, hh, mm, ss)) : undefined;
    const point: TrackPointInput = { seq: points.length, time, secondsOfDay, lat, lon, altM };

    if (previous) {
      totalMeters += haversine(previous.lat, previous.lon, lat, lon);
      const dt = secondsDelta(secondsOfDay, previous.secondsOfDay);
      if (dt > 0 && dt <= 30) point.varioMs = (altM - previous.altM) / dt;
    }

    points.push(point);
    previous = point;
  }

  if (points.length < 2) {
    throw new Error("The IGC file does not contain enough valid B records.");
  }

  const first = points[0];
  const last = points[points.length - 1];
  const durationSeconds = secondsDelta(last.secondsOfDay, first.secondsOfDay);
  const altitudes = points.map((p) => p.altM).filter((alt) => Number.isFinite(alt));
  const varios = points.map((p) => p.varioMs ?? 0);
  const distanceKm = totalMeters / 1000;
  const avgSpeedKmh = durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;
  const scoringWindow = detectScoringWindow(points);
  const scoring = calculateScore(points.slice(scoringWindow.startIndex, scoringWindow.endIndex + 1));
  const thermals = detectThermals(points);

  return {
    pilot,
    glider: detectGlider(lines),
    registration,
    date: date ? `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}` : undefined,
    startTime: first.time,
    durationSeconds,
    distanceKm,
    olcPoints: scoring.score,
    scoring,
    scoringWindow,
    avgSpeedKmh,
    maxAltitudeM: Math.max(...altitudes),
    minAltitudeM: Math.min(...altitudes),
    maxVarioMs: Math.max(...varios),
    points,
    thermals,
    glidePhases: detectGlidePhases(points, thermals)
  };
}

const THERMAL_SAMPLE_CLIMB_THRESHOLD_MS = 0.3;
const THERMAL_MIN_AVG_CLIMB_MS = 0.5;
const THERMAL_MIN_DURATION_SECONDS = 60;
const THERMAL_MIN_GAIN_METERS = 30;
const THERMAL_MAX_INTERRUPTION_SECONDS = 20;

export function detectThermals(points: TrackPointInput[]): ThermalInput[] {
  const thermals: ThermalInput[] = [];
  if (points.length < 2) return thermals;

  let candidateStartIndex: number | null = null;
  let lastClimbIndex: number | null = null;

  const finishCandidate = () => {
    if (candidateStartIndex === null || lastClimbIndex === null) return;

    const start = points[candidateStartIndex];
    const end = points[lastClimbIndex];
    const durationSec = secondsDelta(end.secondsOfDay, start.secondsOfDay);
    const gain = end.altM - start.altM;
    const avgClimbMs = durationSec > 0 ? gain / durationSec : 0;

    if (
      durationSec >= THERMAL_MIN_DURATION_SECONDS &&
      gain > THERMAL_MIN_GAIN_METERS &&
      avgClimbMs > THERMAL_MIN_AVG_CLIMB_MS
    ) {
      const segment = points.slice(candidateStartIndex, lastClimbIndex + 1);
      const varioValues = segment
        .map((point) => point.varioMs)
        .filter((value): value is number => Number.isFinite(value));
      const center = segment[Math.floor(segment.length / 2)] ?? start;

      thermals.push({
        seq: thermals.length + 1,
        startSeq: start.seq,
        endSeq: end.seq,
        startTime: start.time,
        endTime: end.time,
        centerLat: center.lat,
        centerLon: center.lon,
        avgClimbMs: Number(avgClimbMs.toFixed(1)),
        maxClimbMs: varioValues.length > 0 ? Math.max(...varioValues) : 0,
        gainM: Math.round(gain),
        durationSec,
        efficiencyPercent: Number(Math.min(100, Math.max(0,
          (avgClimbMs / (varioValues.length > 0 ? Math.max(...varioValues) : avgClimbMs)) * 100
        )).toFixed(1))
      });
    }

    candidateStartIndex = null;
    lastClimbIndex = null;
  };

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const sampleDuration = secondsDelta(
      current.secondsOfDay,
      previous.secondsOfDay
    );

    if (sampleDuration <= 0 || sampleDuration > 30) {
      finishCandidate();
      continue;
    }

    const sampleClimbMs =
      current.varioMs ?? (current.altM - previous.altM) / sampleDuration;

    if (sampleClimbMs >= THERMAL_SAMPLE_CLIMB_THRESHOLD_MS) {
      candidateStartIndex ??= index - 1;
      lastClimbIndex = index;
      continue;
    }

    if (candidateStartIndex !== null && lastClimbIndex !== null) {
      const interruptionSeconds = secondsDelta(
        current.secondsOfDay,
        points[lastClimbIndex].secondsOfDay
      );

      if (interruptionSeconds > THERMAL_MAX_INTERRUPTION_SECONDS) {
        finishCandidate();
      }
    }
  }

  finishCandidate();

  return thermals;
}

const GLIDE_MIN_DURATION_SECONDS = 30;
const GLIDE_MIN_DISTANCE_METERS = 250;

export function detectGlidePhases(
  points: TrackPointInput[],
  thermals: ThermalInput[] = detectThermals(points)
): GlidePhaseInput[] {
  const phases: GlidePhaseInput[] = [];
  if (points.length < 2) return phases;

  const thermalSequences = new Set<number>();
  for (const thermal of thermals) {
    for (let seq = thermal.startSeq; seq <= thermal.endSeq; seq += 1) {
      thermalSequences.add(seq);
    }
  }

  let startIndex: number | null = null;
  let endIndex: number | null = null;

  const finishPhase = () => {
    if (startIndex === null || endIndex === null) return;

    const start = points[startIndex];
    const end = points[endIndex];
    const durationSec = secondsDelta(end.secondsOfDay, start.secondsOfDay);
    let distanceM = 0;

    for (let index = startIndex + 1; index <= endIndex; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      distanceM += haversine(previous.lat, previous.lon, current.lat, current.lon);
    }

    if (
      durationSec >= GLIDE_MIN_DURATION_SECONDS &&
      distanceM >= GLIDE_MIN_DISTANCE_METERS
    ) {
      const altitudeLossM = start.altM - end.altM;
      phases.push({
        seq: phases.length + 1,
        startSeq: start.seq,
        endSeq: end.seq,
        startTime: start.time,
        endTime: end.time,
        durationSec,
        distanceKm: Number((distanceM / 1000).toFixed(2)),
        avgSpeedKmh: Number(((distanceM / durationSec) * 3.6).toFixed(1)),
        avgSinkMs: Number(((end.altM - start.altM) / durationSec).toFixed(2)),
        glideRatio: altitudeLossM > 1
          ? Number((distanceM / altitudeLossM).toFixed(1))
          : 0
      });
    }

    startIndex = null;
    endIndex = null;
  };

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const sampleDuration = secondsDelta(current.secondsOfDay, previous.secondsOfDay);
    const isContinuous = sampleDuration > 0 && sampleDuration <= 30;
    const isOutsideThermal =
      !thermalSequences.has(previous.seq) && !thermalSequences.has(current.seq);

    if (!isContinuous || !isOutsideThermal) {
      finishPhase();
      continue;
    }

    startIndex ??= index - 1;
    endIndex = index;
  }

  finishPhase();
  return phases;
}
