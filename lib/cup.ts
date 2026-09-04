import type {TaskPoint} from "./task-planner.ts";

export type CupWaypoint = TaskPoint & {
  name: string;
  country: string | null;
  elevationM: number | null;
  style: number | null;
  description: string | null;
};

export type CupTask = {name: string; points: TaskPoint[]};
export type CupData = {waypoints: CupWaypoint[]; tasks: CupTask[]};

export class CupParseError extends Error {
  code: string;
  line?: number;

  constructor(code: string, line?: number) {
    super(line ? `${code} at line ${line}` : code);
    this.code = code;
    this.line = line;
  }
}

export function parseCsvLine(line: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(value.trim()); value = "";
    } else value += char;
  }
  if (quoted) throw new CupParseError("unclosed-quote");
  fields.push(value.trim());
  return fields;
}

export function parseCupCoordinate(value: string, axis: "lat" | "lon") {
  const degreesDigits = axis === "lat" ? 2 : 3;
  const pattern = new RegExp(`^(\\d{${degreesDigits}})(\\d{2}(?:\\.\\d+)?)([${axis === "lat" ? "NS" : "EW"}])$`, "i");
  const match = value.trim().match(pattern);
  if (!match) throw new CupParseError(`invalid-${axis}`);
  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes >= 60 || degrees > (axis === "lat" ? 90 : 180)) throw new CupParseError(`invalid-${axis}`);
  const sign = /[SW]/i.test(match[3]) ? -1 : 1;
  return sign * (degrees + minutes / 60);
}

function parseElevation(value: string) {
  if (!value) return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(m|ft)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return /ft/i.test(match[2] ?? "") ? amount * 0.3048 : amount;
}

function parseRadius(value: string) {
  const match = value.match(/^(-?\d+(?:\.\d+)?)(m|km|nm|ml)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2]?.toLowerCase() === "km" ? 1000 : match[2]?.toLowerCase() === "nm" ? 1852 : match[2]?.toLowerCase() === "ml" ? 1609.344 : 1;
  const meters = Math.round(amount * multiplier);
  return meters >= 50 && meters <= 20_000 ? meters : null;
}

export function parseCup(text: string): CupData {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstLine < 0) throw new CupParseError("empty");
  const header = parseCsvLine(lines[firstLine]).map((field) => field.toLowerCase());
  const required = ["name", "lat", "lon"];
  if (required.some((field) => !header.includes(field))) throw new CupParseError("invalid-header", firstLine + 1);
  const column = (name: string) => header.indexOf(name);
  const waypoints: CupWaypoint[] = [];
  const byName = new Map<string, CupWaypoint>();
  let taskStart = lines.length;

  for (let lineIndex = firstLine + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) continue;
    if (/^-{4,}Related Tasks-{4,}$/i.test(line)) { taskStart = lineIndex + 1; break; }
    let fields: string[];
    try { fields = parseCsvLine(lines[lineIndex]); } catch { throw new CupParseError("invalid-csv", lineIndex + 1); }
    const name = fields[column("name")]?.trim();
    if (!name) throw new CupParseError("missing-name", lineIndex + 1);
    const key = name.toLocaleLowerCase("en");
    if (byName.has(key)) throw new CupParseError("duplicate-waypoint", lineIndex + 1);
    let lat: number;
    let lon: number;
    try {
      lat = parseCupCoordinate(fields[column("lat")] ?? "", "lat");
      lon = parseCupCoordinate(fields[column("lon")] ?? "", "lon");
    } catch (error) {
      if (error instanceof CupParseError) throw new CupParseError(error.code, lineIndex + 1);
      throw error;
    }
    const styleValue = column("style") >= 0 ? Number(fields[column("style")]) : NaN;
    const waypoint: CupWaypoint = {
      name: name.slice(0, 120),
      code: column("code") >= 0 ? fields[column("code")]?.trim().toUpperCase().slice(0, 24) || null : null,
      country: column("country") >= 0 ? fields[column("country")]?.trim().toUpperCase().slice(0, 8) || null : null,
      lat, lon,
      radiusM: 500,
      elevationM: column("elev") >= 0 ? parseElevation(fields[column("elev")] ?? "") : null,
      style: Number.isInteger(styleValue) && styleValue >= 0 && styleValue <= 21 ? styleValue : null,
      description: column("desc") >= 0 ? fields[column("desc")]?.trim().slice(0, 2000) || null : null
    };
    waypoints.push(waypoint);
    byName.set(key, waypoint);
  }
  if (!waypoints.length) throw new CupParseError("no-waypoints");
  if (waypoints.length > 20_000) throw new CupParseError("too-many-waypoints");

  const tasks: CupTask[] = [];
  let currentTask: CupTask | null = null;
  for (let lineIndex = taskStart; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line || /^Options(?:,|$)/i.test(line) || /^STARTS=/i.test(line) || /^Point=/i.test(line)) continue;
    const zone = line.match(/^ObsZone=(\d+).*?(?:^|,)R1=([^,\s]+)/i);
    if (zone && currentTask) {
      const point = currentTask.points[Number(zone[1])];
      const radiusM = parseRadius(zone[2]);
      if (point && radiusM) point.radiusM = radiusM;
      continue;
    }
    let fields: string[];
    try { fields = parseCsvLine(lines[lineIndex]); } catch { throw new CupParseError("invalid-task-csv", lineIndex + 1); }
    const names = fields.slice(1).filter(Boolean);
    if (names.length < 2) throw new CupParseError("invalid-task", lineIndex + 1);
    const points = names.map((name) => {
      const waypoint = byName.get(name.toLocaleLowerCase("en"));
      if (!waypoint) throw new CupParseError("unknown-task-waypoint", lineIndex + 1);
      return {name: waypoint.name, code: waypoint.code, lat: waypoint.lat, lon: waypoint.lon, radiusM: 500};
    });
    currentTask = {name: fields[0]?.trim().slice(0, 120) || `Imported task ${tasks.length + 1}`, points};
    tasks.push(currentTask);
  }
  if (tasks.length > 100) throw new CupParseError("too-many-tasks");
  return {waypoints, tasks};
}
