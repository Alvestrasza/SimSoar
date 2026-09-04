export type Flight3dPoint = {lat: number; lon: number; altM: number};

export type NormalizedFlight3d = {
  vertices: number[];
  minAltitudeM: number;
  maxAltitudeM: number;
};

export function normalizeFlight3d(points: Flight3dPoint[]): NormalizedFlight3d {
  const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.altM));
  if (valid.length === 0) return {vertices: [], minAltitudeM: 0, maxAltitudeM: 0};
  const minLat = Math.min(...valid.map((point) => point.lat));
  const maxLat = Math.max(...valid.map((point) => point.lat));
  const minLon = Math.min(...valid.map((point) => point.lon));
  const maxLon = Math.max(...valid.map((point) => point.lon));
  const minAltitudeM = Math.min(...valid.map((point) => point.altM));
  const maxAltitudeM = Math.max(...valid.map((point) => point.altM));
  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;
  const altitudeRange = maxAltitudeM - minAltitudeM || 1;
  const vertices = valid.flatMap((point) => [
    ((point.lon - minLon) / lonRange - 0.5) * 1.5,
    ((point.altM - minAltitudeM) / altitudeRange - 0.5) * 1.1,
    ((point.lat - minLat) / latRange - 0.5) * 1.5
  ]);
  return {vertices, minAltitudeM, maxAltitudeM};
}
