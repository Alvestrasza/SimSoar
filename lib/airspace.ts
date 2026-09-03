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

export function parseOpenAir(text: string): AirspacePolygon[] {
  const airspaces: AirspacePolygon[] = [];
  let current: AirspacePolygon | null = null;

  const finish = () => {
    if (current && current.points.length >= 3) airspaces.push(current);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("*")) continue;
    const command = line.slice(0, 2).toUpperCase();
    const value = line.slice(2).trim();

    if (command === "AC") {
      finish();
      current = {name: "Unnamed airspace", className: value || "UNKNOWN", floorLabel: "Unknown", ceilingLabel: "Unknown", points: []};
    } else if (current && command === "AN") current.name = value || current.name;
    else if (current && command === "AL") current.floorLabel = value || current.floorLabel;
    else if (current && command === "AH") current.ceilingLabel = value || current.ceilingLabel;
    else if (current && command === "DP") {
      const point = parseOpenAirCoordinate(value);
      if (point) current.points.push(point);
    }
  }
  finish();
  return airspaces;
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
