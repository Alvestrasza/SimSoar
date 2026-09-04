import {waypointDistanceMeters} from "./task-planner.ts";

export type SegmentDefinition = {startLat: number; startLon: number; finishLat: number; finishLon: number; gateRadiusM: number};
export type SegmentTrackPoint = {seq: number; lat: number; lon: number; time?: Date | string | null};

function timestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function detectSegmentCompletion(segment: SegmentDefinition, track: SegmentTrackPoint[]) {
  const start = {lat: segment.startLat, lon: segment.startLon};
  const finish = {lat: segment.finishLat, lon: segment.finishLon};
  let previousStartInside = false;
  let previousFinishInside = false;
  let activeStart: {seq: number; time: number} | null = null;
  let best: {startSeq: number; finishSeq: number; durationSeconds: number; completedAt: Date} | null = null;

  for (const point of track) {
    const startInside = waypointDistanceMeters(start, point) <= segment.gateRadiusM;
    const finishInside = waypointDistanceMeters(finish, point) <= segment.gateRadiusM;
    const pointTime = timestamp(point.time);

    if (startInside && !previousStartInside && pointTime != null) {
      activeStart = {seq: point.seq, time: pointTime};
    }

    if (finishInside && !previousFinishInside && activeStart && point.seq > activeStart.seq && pointTime != null && pointTime > activeStart.time) {
      const result = {
        startSeq: activeStart.seq,
        finishSeq: point.seq,
        durationSeconds: Math.round((pointTime - activeStart.time) / 1000),
        completedAt: new Date(pointTime)
      };
      if (!best || result.durationSeconds < best.durationSeconds) best = result;
      activeStart = null;
    }

    previousStartInside = startInside;
    previousFinishInside = finishInside;
  }

  return best;
}

export function segmentLeaderboard<T extends {userId: string; durationSeconds: number; completedAt: Date | null}>(results: T[]) {
  return [...results].sort((a, b) => a.durationSeconds - b.durationSeconds || (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
}
