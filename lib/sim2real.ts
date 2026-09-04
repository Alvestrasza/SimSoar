import {findAirspaceCrossings, type AirspacePolygon} from "./airspace.ts";
import {exportTaskToCup} from "./cup.ts";
import {taskDistanceKm, type TaskPoint} from "./task-planner.ts";

export const SIM2REAL_REVIEW_VERSION = "1.0.0" as const;
export const DEFAULT_AIRSPACE_MAX_AGE_DAYS = 28;
export type ReviewState = "PASS" | "WARNING" | "CONFLICT" | "UNKNOWN";

export type Sim2RealAssumptions = {
  aircraft: string | null;
  glideRatio: number | null;
  cruiseSpeedKmh: number | null;
  plannedAltitudeM: number | null;
};

export type Sim2RealDataset = {
  kind: "TASK" | "AIRSPACE" | "TERRAIN" | "AERODROME" | "WEATHER" | "NOTAM" | "AIRCRAFT";
  source: string;
  timestamp: string | null;
  state: ReviewState;
  detail: string;
};

export function parseAirspaceAltitude(label: string): number | null {
  const normalized = label.trim().toUpperCase().replace(/\s+/g, " ");
  if (/^(GND|SFC|SURFACE)$/.test(normalized)) return 0;
  if (/^(UNL|UNLIMITED)$/.test(normalized)) return Number.POSITIVE_INFINITY;
  const flightLevel = normalized.match(/^FL\s*(\d{1,3})$/);
  if (flightLevel) return Number(flightLevel[1]) * 100 * 0.3048;
  const feet = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:FT|F)\b/);
  if (feet) return Number(feet[1]) * 0.3048;
  const meters = normalized.match(/^(\d+(?:\.\d+)?)\s*M\b/);
  return meters ? Number(meters[1]) : null;
}

export function verticalConflict(plannedAltitudeM: number | null, floorLabel: string, ceilingLabel: string): boolean | null {
  if (plannedAltitudeM === null) return null;
  const floor = parseAirspaceAltitude(floorLabel);
  const ceiling = parseAirspaceAltitude(ceilingLabel);
  if (floor === null || ceiling === null) return null;
  return plannedAltitudeM >= floor && plannedAltitudeM <= ceiling;
}

function finiteNumber(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "string" && value.trim() ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function parseSim2RealAssumptions(input: Record<string, unknown>): Sim2RealAssumptions {
  const aircraft = typeof input.aircraft === "string" ? input.aircraft.trim().slice(0, 120) || null : null;
  return {
    aircraft,
    glideRatio: finiteNumber(input.glideRatio, 5, 100),
    cruiseSpeedKmh: finiteNumber(input.cruiseSpeedKmh, 30, 300),
    plannedAltitudeM: finiteNumber(input.plannedAltitudeM, 0, 15_000)
  };
}

export function buildSim2RealReview(input: {
  task: {id: string; lineageId: string; revision: number; name: string; updatedAt: Date; waypoints: TaskPoint[]};
  airspaces: Array<AirspacePolygon & {id: string; sourceName: string; createdAt: Date}>;
  assumptions: Sim2RealAssumptions;
  now?: Date;
  airspaceMaxAgeDays?: number;
  airspaceQueryTruncated?: boolean;
}) {
  const now = input.now ?? new Date();
  const route = input.task.waypoints.map((point, seq) => ({...point, seq}));
  const crossings = findAirspaceCrossings(route, input.airspaces).map((crossing) => ({
    ...crossing,
    verticalConflict: verticalConflict(input.assumptions.plannedAltitudeM, crossing.floorLabel, crossing.ceilingLabel)
  }));
  const newestAirspace = input.airspaces.reduce<Date | null>((latest, item) => !latest || item.createdAt > latest ? item.createdAt : latest, null);
  const ageMs = newestAirspace ? now.getTime() - newestAirspace.getTime() : Number.POSITIVE_INFINITY;
  const stale = ageMs > (input.airspaceMaxAgeDays ?? DEFAULT_AIRSPACE_MAX_AGE_DAYS) * 86_400_000;
  const sourceNames = [...new Set(input.airspaces.map((item) => item.sourceName))].slice(0, 20);
  const distanceKm = taskDistanceKm(input.task.waypoints);
  const estimatedDurationMinutes = input.assumptions.cruiseSpeedKmh ? Math.round(distanceKm / input.assumptions.cruiseSpeedKmh * 60) : null;
  const datasets: Sim2RealDataset[] = [
    {kind: "TASK", source: "SimSoar task record", timestamp: input.task.updatedAt.toISOString(), state: "PASS", detail: `Revision ${input.task.revision}`},
    {kind: "AIRSPACE", source: sourceNames.join(", ") || "No imported source", timestamp: newestAirspace?.toISOString() ?? null, state: !newestAirspace || stale || input.airspaceQueryTruncated ? "WARNING" : crossings.some((item) => item.verticalConflict === true) ? "CONFLICT" : crossings.some((item) => item.verticalConflict === null) ? "WARNING" : "PASS", detail: !newestAirspace ? "missing" : input.airspaceQueryTruncated ? "query-truncated" : stale ? "stale" : `${crossings.length} horizontal crossing(s)`},
    {kind: "TERRAIN", source: "No terrain dataset configured", timestamp: null, state: "UNKNOWN", detail: "missing"},
    {kind: "AERODROME", source: "No current aerodrome dataset configured", timestamp: null, state: "UNKNOWN", detail: "missing"},
    {kind: "WEATHER", source: "Independent official briefing required", timestamp: null, state: "UNKNOWN", detail: "not-integrated"},
    {kind: "NOTAM", source: "Independent official briefing required", timestamp: null, state: "UNKNOWN", detail: "not-integrated"},
    {kind: "AIRCRAFT", source: input.assumptions.aircraft || "No aircraft selected", timestamp: now.toISOString(), state: input.assumptions.aircraft && input.assumptions.glideRatio ? "PASS" : "WARNING", detail: input.assumptions.glideRatio ? `assumed glide ratio ${input.assumptions.glideRatio}:1` : "assumptions-incomplete"}
  ];
  return {
    reviewVersion: SIM2REAL_REVIEW_VERSION,
    generatedAt: now.toISOString(),
    task: {id: input.task.id, lineageId: input.task.lineageId, revision: input.task.revision, name: input.task.name, updatedAt: input.task.updatedAt.toISOString()},
    assumptions: input.assumptions,
    summary: {distanceKm, estimatedDurationMinutes, alternatePlanning: "required", terrainClearance: "unknown" as const},
    crossings,
    datasets,
    readyForExport: true,
    safetyDecision: "PILOT_IN_COMMAND_REQUIRED" as const
  };
}

export function buildPlanningDraftBundle(task: {name: string; waypoints: TaskPoint[]}, review: ReturnType<typeof buildSim2RealReview>) {
  return {
    format: "simsoar-flight-planning-draft",
    schemaVersion: "1.0.0",
    warning: "FLIGHT-PLANNING DRAFT ONLY. NOT AN APPROVED OR SAFE ROUTE. THE PILOT IN COMMAND MUST COMPLETE A CURRENT OFFICIAL BRIEFING.",
    review,
    files: [{path: "task-planning-draft.cup", mediaType: "text/csv", encoding: "base64", data: Buffer.from(exportTaskToCup({name: `[PLANNING DRAFT] ${task.name}`, waypoints: task.waypoints}), "utf8").toString("base64")}]
  };
}
