export type WindConfidence = "LOW" | "MEDIUM" | "HIGH";

export type WindEstimate = {
  directionDeg: number;
  speedKmh: number;
  confidence: WindConfidence;
  driftDistanceM: number;
};

type WindTrackPoint = {
  secondsOfDay: number;
  lat: number;
  lon: number;
};

function secondsDelta(current: number, previous: number) {
  const delta = current - previous;
  return delta < 0 ? delta + 86400 : delta;
}

function centroid(points: WindTrackPoint[]) {
  return points.reduce(
    (sum, point) => ({lat: sum.lat + point.lat / points.length, lon: sum.lon + point.lon / points.length}),
    {lat: 0, lon: 0}
  );
}

function displacement(from: {lat: number; lon: number}, to: {lat: number; lon: number}) {
  const radiusM = 6371000;
  const phi1 = from.lat * Math.PI / 180;
  const phi2 = to.lat * Math.PI / 180;
  const deltaPhi = (to.lat - from.lat) * Math.PI / 180;
  const deltaLambda = (to.lon - from.lon) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const distanceM = radiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const bearingToDeg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return {distanceM, bearingToDeg};
}

export function estimateThermalWind(points: WindTrackPoint[]): WindEstimate | null {
  if (points.length < 6) return null;

  const clusterSize = Math.max(2, Math.floor(points.length * 0.2));
  const startCluster = points.slice(0, clusterSize);
  const endCluster = points.slice(-clusterSize);
  const startCenter = centroid(startCluster);
  const endCenter = centroid(endCluster);
  const startTime = startCluster[Math.floor(startCluster.length / 2)].secondsOfDay;
  const endTime = endCluster[Math.floor(endCluster.length / 2)].secondsOfDay;
  const durationSec = secondsDelta(endTime, startTime);
  if (durationSec <= 0) return null;

  const {distanceM, bearingToDeg} = displacement(startCenter, endCenter);
  const speedKmh = distanceM / durationSec * 3.6;
  if (!Number.isFinite(speedKmh) || speedKmh > 150) return null;

  const confidence: WindConfidence =
    durationSec >= 140 && distanceM >= 80 && points.length >= 20
      ? "HIGH"
      : durationSec >= 70 && distanceM >= 30 && points.length >= 10
        ? "MEDIUM"
        : "LOW";

  return {
    directionDeg: Math.round((bearingToDeg + 180) % 360),
    speedKmh: Number(speedKmh.toFixed(1)),
    confidence,
    driftDistanceM: Math.round(distanceM)
  };
}

export function summarizeWindEstimates(
  estimates: Array<{directionDeg: number | null; speedKmh: number | null; confidence: WindConfidence | null}>
): WindEstimate | null {
  const reliable = estimates.filter(
    (estimate): estimate is {directionDeg: number; speedKmh: number; confidence: "MEDIUM" | "HIGH"} =>
      estimate.directionDeg !== null && estimate.speedKmh !== null && estimate.confidence !== null && estimate.confidence !== "LOW"
  );
  if (reliable.length === 0) return null;

  let eastward = 0;
  let northward = 0;
  for (const estimate of reliable) {
    const driftDirectionRad = (estimate.directionDeg + 180) * Math.PI / 180;
    eastward += Math.sin(driftDirectionRad) * estimate.speedKmh;
    northward += Math.cos(driftDirectionRad) * estimate.speedKmh;
  }

  eastward /= reliable.length;
  northward /= reliable.length;
  const speedKmh = Math.sqrt(eastward ** 2 + northward ** 2);
  const driftDirectionDeg = (Math.atan2(eastward, northward) * 180 / Math.PI + 360) % 360;

  return {
    directionDeg: Math.round((driftDirectionDeg + 180) % 360),
    speedKmh: Number(speedKmh.toFixed(1)),
    confidence: reliable.length >= 2 && reliable.some((estimate) => estimate.confidence === "HIGH") ? "HIGH" : "MEDIUM",
    driftDistanceM: 0
  };
}
