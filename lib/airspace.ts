export type AirspacePoint = {lat: number; lon: number};
export type AirspacePolygon = {
  id?: string;
  name: string;
  className: string;
  floorLabel: string;
  ceilingLabel: string;
  points: AirspacePoint[];
};

export type AirspaceCrossing = {
  airspaceId: string;
  name: string;
  className: string;
  floorLabel: string;
  ceilingLabel: string;
  firstTrackSeq: number;
  lastTrackSeq: number;
};

export type AirspaceImportLimits = {
  maxAirspaces: number;
  maxPointsPerAirspace: number;
  maxTotalPoints: number;
};

export type AirspaceImportValidation = {
  ok: boolean;
  reason: "airspaces" | "points-per-airspace" | "total-points" | null;
  totalPoints: number;
};

export type AirspaceBounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_NAUTICAL_MILE = 1852;
const MAX_ARC_POINTS = 4096;

function coordinatePart(degrees: number, minutes: number, seconds: number, hemisphere: string) {
  const value = degrees + minutes / 60 + seconds / 3600;
  return hemisphere === "S" || hemisphere === "W" ? -value : value;
}

export function parseOpenAirCoordinate(value: string): AirspacePoint | null {
  const standard = value.match(/(\d{1,2}):(?<latMin>\d{2}):(?<latSec>\d{2}(?:\.\d+)?)\s*([NS])\s*[, ]+\s*(\d{1,3}):(?<lonMin>\d{2}):(?<lonSec>\d{2}(?:\.\d+)?)\s*([EW])/i);
  if (standard?.groups) {
    return {
      lat: coordinatePart(Number(standard[1]), Number(standard.groups.latMin), Number(standard.groups.latSec), standard[4].toUpperCase()),
      lon: coordinatePart(Number(standard[5]), Number(standard.groups.lonMin), Number(standard.groups.lonSec), standard[8].toUpperCase())
    };
  }

  const decimal = value.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!decimal) return null;
  const lat = Number(decimal[1]);
  const lon = Number(decimal[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? {lat, lon} : null;
}

function coordinatesIn(value: string) {
  const coordinates: AirspacePoint[] = [];
  const coordinatePattern = /(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\s*[NS])\s*[, ]+\s*(\d{1,3}:\d{2}:\d{2}(?:\.\d+)?\s*[EW])/gi;
  for (const match of value.matchAll(coordinatePattern)) {
    const point = parseOpenAirCoordinate(`${match[1]} ${match[2]}`);
    if (point) coordinates.push(point);
  }
  return coordinates;
}

function destinationPoint(center: AirspacePoint, bearingDeg: number, radiusNm: number): AirspacePoint {
  const angularDistance = radiusNm * METERS_PER_NAUTICAL_MILE / EARTH_RADIUS_M;
  const bearing = bearingDeg * Math.PI / 180;
  const lat1 = center.lat * Math.PI / 180;
  const lon1 = center.lon * Math.PI / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: lat2 * 180 / Math.PI,
    lon: ((lon2 * 180 / Math.PI + 540) % 360) - 180
  };
}

function initialBearing(center: AirspacePoint, point: AirspacePoint) {
  const lat1 = center.lat * Math.PI / 180;
  const lat2 = point.lat * Math.PI / 180;
  const deltaLon = (point.lon - center.lon) * Math.PI / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distanceNm(a: AirspacePoint, b: AirspacePoint) {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = lat2 - lat1;
  const deltaLon = (b.lon - a.lon) * Math.PI / 180;
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))) / METERS_PER_NAUTICAL_MILE;
}

function arcPoints(center: AirspacePoint, radiusNm: number, startDeg: number, endDeg: number, clockwise: boolean) {
  if (!Number.isFinite(radiusNm) || radiusNm <= 0) return [];
  const normalizedStart = (startDeg % 360 + 360) % 360;
  const normalizedEnd = (endDeg % 360 + 360) % 360;
  const sweep = clockwise
    ? (normalizedEnd - normalizedStart + 360) % 360 || 360
    : (normalizedStart - normalizedEnd + 360) % 360 || 360;
  const arcLengthNm = 2 * Math.PI * radiusNm * sweep / 360;
  const segments = Math.min(MAX_ARC_POINTS, Math.max(2, Math.ceil(sweep / 3), Math.ceil(arcLengthNm / 0.25)));
  return Array.from({length: segments + 1}, (_, index) => {
    const offset = sweep * index / segments;
    return destinationPoint(center, clockwise ? normalizedStart + offset : normalizedStart - offset, radiusNm);
  });
}

function appendDistinct(points: AirspacePoint[], additions: AirspacePoint[]) {
  for (const point of additions) {
    const previous = points.at(-1);
    if (!previous || Math.abs(previous.lat - point.lat) > 1e-9 || Math.abs(previous.lon - point.lon) > 1e-9) {
      points.push(point);
    }
  }
}

export function parseOpenAir(text: string): AirspacePolygon[] {
  const airspaces: AirspacePolygon[] = [];
  let current: AirspacePolygon | null = null;
  let arcCenter: AirspacePoint | null = null;
  let clockwise = true;

  const finish = () => {
    if (current && current.points.length >= 3) airspaces.push(current);
    current = null;
    arcCenter = null;
    clockwise = true;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("*")) continue;
    const isVariableCommand = /^V\s/i.test(line);
    const command = (isVariableCommand ? "V" : line.slice(0, 2)).toUpperCase();
    const value = line.slice(isVariableCommand ? 1 : 2).trim();

    if (command === "AC") {
      finish();
      current = {name: "Unnamed airspace", className: value || "UNKNOWN", floorLabel: "Unknown", ceilingLabel: "Unknown", points: []};
    } else if (current && command === "AN") current.name = value || current.name;
    else if (current && command === "AL") current.floorLabel = value || current.floorLabel;
    else if (current && command === "AH") current.ceilingLabel = value || current.ceilingLabel;
    else if (current && command === "DP") {
      const point = parseOpenAirCoordinate(value);
      if (point) current.points.push(point);
    } else if (current && command === "V") {
      const centerMatch = value.match(/^X\s*=\s*(.+)$/i);
      const directionMatch = value.match(/^D\s*=\s*([+-])/i);
      if (centerMatch) arcCenter = parseOpenAirCoordinate(centerMatch[1]);
      if (directionMatch) clockwise = directionMatch[1] === "+";
    } else if (current && command === "DC" && arcCenter) {
      const radiusNm = Number.parseFloat(value.replace(",", "."));
      if (Number.isFinite(radiusNm) && radiusNm > 0) {
        current.points = arcPoints(arcCenter, radiusNm, 0, 360, true);
      }
    } else if (current && command === "DB" && arcCenter) {
      const [start, end] = coordinatesIn(value);
      if (start && end) {
        const radiusNm = (distanceNm(arcCenter, start) + distanceNm(arcCenter, end)) / 2;
        appendDistinct(current.points, arcPoints(
          arcCenter,
          radiusNm,
          initialBearing(arcCenter, start),
          initialBearing(arcCenter, end),
          clockwise
        ));
      }
    } else if (current && command === "DA" && arcCenter) {
      const [radiusNm, startDeg, endDeg] = value.split(",").map((part) => Number.parseFloat(part.trim()));
      if ([radiusNm, startDeg, endDeg].every(Number.isFinite)) {
        appendDistinct(current.points, arcPoints(arcCenter, radiusNm, startDeg, endDeg, clockwise));
      }
    }
  }
  finish();
  return airspaces;
}

export function validateAirspaceImport(
  airspaces: AirspacePolygon[],
  limits: AirspaceImportLimits
): AirspaceImportValidation {
  const totalPoints = airspaces.reduce((sum, airspace) => sum + airspace.points.length, 0);
  if (airspaces.length > limits.maxAirspaces) return {ok: false, reason: "airspaces", totalPoints};
  if (airspaces.some((airspace) => airspace.points.length > limits.maxPointsPerAirspace)) {
    return {ok: false, reason: "points-per-airspace", totalPoints};
  }
  if (totalPoints > limits.maxTotalPoints) return {ok: false, reason: "total-points", totalPoints};
  return {ok: true, reason: null, totalPoints};
}

export function airspaceBounds(points: AirspacePoint[]): AirspaceBounds {
  if (points.length === 0) throw new Error("Cannot calculate bounds for an empty airspace.");
  return points.reduce<AirspaceBounds>((bounds, point) => ({
    minLat: Math.min(bounds.minLat, point.lat),
    maxLat: Math.max(bounds.maxLat, point.lat),
    minLon: Math.min(bounds.minLon, point.lon),
    maxLon: Math.max(bounds.maxLon, point.lon)
  }), {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180});
}

export function pointInPolygon(point: AirspacePoint, polygon: AirspacePoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = (a.lat > point.lat) !== (b.lat > point.lat) &&
      point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon;
    if (intersects) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a: AirspacePoint, b: AirspacePoint, c: AirspacePoint, d: AirspacePoint) {
  const cross = (p: AirspacePoint, q: AirspacePoint, r: AirspacePoint) =>
    (q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return ((abC <= 0 && abD >= 0) || (abC >= 0 && abD <= 0)) &&
    ((cdA <= 0 && cdB >= 0) || (cdA >= 0 && cdB <= 0));
}

function segmentCrossesPolygon(a: AirspacePoint, b: AirspacePoint, polygon: AirspacePoint[]) {
  for (let index = 0; index < polygon.length; index += 1) {
    if (segmentsIntersect(a, b, polygon[index], polygon[(index + 1) % polygon.length])) return true;
  }
  return false;
}

export function findAirspaceCrossings(
  track: Array<AirspacePoint & {seq: number}>,
  airspaces: Array<AirspacePolygon & {id: string}>
): AirspaceCrossing[] {
  const crossings: AirspaceCrossing[] = [];
  for (const airspace of airspaces) {
    const inside = track.filter((point) => pointInPolygon(point, airspace.points));
    const crossingSegments = track.slice(1).flatMap((point, index) =>
      segmentCrossesPolygon(track[index], point, airspace.points) ? [[track[index], point] as const] : []
    );
    if (inside.length === 0 && crossingSegments.length === 0) continue;
    const firstTrackSeq = Math.min(
      inside[0]?.seq ?? Number.POSITIVE_INFINITY,
      crossingSegments[0]?.[0].seq ?? Number.POSITIVE_INFINITY
    );
    const lastSegment = crossingSegments.at(-1);
    const lastTrackSeq = Math.max(
      inside.at(-1)?.seq ?? Number.NEGATIVE_INFINITY,
      lastSegment?.[1].seq ?? Number.NEGATIVE_INFINITY
    );
    crossings.push({
      airspaceId: airspace.id,
      name: airspace.name,
      className: airspace.className,
      floorLabel: airspace.floorLabel,
      ceilingLabel: airspace.ceilingLabel,
      firstTrackSeq,
      lastTrackSeq
    });
  }
  return crossings;
}
