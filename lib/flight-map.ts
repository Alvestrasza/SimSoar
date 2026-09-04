export type FlightMapPoint = {
  lat: number;
  lon: number;
  altM?: number;
};

export function simplifyFlightTrack<T extends FlightMapPoint>(
  points: T[],
  maxPoints = 120
): T[] {
  if (points.length <= maxPoints || maxPoints < 2) {
    return [...points];
  }

  const lastIndex = points.length - 1;
  const result: T[] = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    const point = points[sourceIndex];

    if (result.at(-1) !== point) {
      result.push(point);
    }
  }

  return result;
}

export function flightTrackEndpoints(points: FlightMapPoint[]) {
  if (points.length === 0) return null;

  return {
    start: points[0],
    finish: points.at(-1)!
  };
}
