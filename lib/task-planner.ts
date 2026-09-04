export type TaskPoint = {
  name?: string | null;
  code?: string | null;
  lat: number;
  lon: number;
  radiusM?: number;
};

export type FlightPoint = {seq: number; lat: number; lon: number};

const EARTH_RADIUS_M = 6_371_000;

function radians(value: number) {
  return value * Math.PI / 180;
}

export function waypointDistanceMeters(a: Pick<TaskPoint, "lat" | "lon">, b: Pick<TaskPoint, "lat" | "lon">) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function taskDistanceKm(points: TaskPoint[]) {
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    meters += waypointDistanceMeters(points[index - 1], points[index]);
  }
  return Number((meters / 1000).toFixed(2));
}

export function normalizeTaskPoints(points: TaskPoint[]) {
  if (points.length < 2 || points.length > 100) throw new Error("A task requires between 2 and 100 waypoints.");
  return points.map((point, seq) => {
    if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) throw new Error(`Waypoint ${seq + 1} has an invalid latitude.`);
    if (!Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) throw new Error(`Waypoint ${seq + 1} has an invalid longitude.`);
    const radiusM = Math.round(point.radiusM ?? 500);
    if (radiusM < 50 || radiusM > 20_000) throw new Error(`Waypoint ${seq + 1} has an invalid observation radius.`);
    return {
      seq,
      name: point.name?.trim().slice(0, 120) || null,
      code: point.code?.trim().toUpperCase().slice(0, 24) || null,
      lat: Number(point.lat),
      lon: Number(point.lon),
      radiusM
    };
  });
}

export function compareTaskWithFlight(task: TaskPoint[], track: FlightPoint[]) {
  let searchFrom = 0;
  const waypoints = task.map((waypoint) => {
    let nearestDistanceM = Number.POSITIVE_INFINITY;
    let nearestSeq: number | null = null;
    let matchedIndex = -1;
    for (let index = searchFrom; index < track.length; index += 1) {
      const distanceM = waypointDistanceMeters(waypoint, track[index]);
      if (distanceM < nearestDistanceM) {
        nearestDistanceM = distanceM;
        nearestSeq = track[index].seq;
      }
      if (distanceM <= (waypoint.radiusM ?? 500)) {
        matchedIndex = index;
        nearestDistanceM = distanceM;
        nearestSeq = track[index].seq;
        break;
      }
    }
    const reached = matchedIndex >= 0;
    if (reached) searchFrom = matchedIndex + 1;
    return {reached, nearestDistanceM: Math.round(nearestDistanceM), trackSeq: nearestSeq};
  });
  const reachedCount = waypoints.filter((waypoint) => waypoint.reached).length;
  return {
    completed: reachedCount === task.length,
    reachedCount,
    coveragePercent: task.length ? Math.round(reachedCount / task.length * 100) : 0,
    waypoints
  };
}
