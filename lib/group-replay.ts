import {buildReplayTimeline, replayIndexAtElapsed} from "./flight-replay.ts";

export type GroupReplayFlight = {id: string; track: Array<{seq: number; time?: Date | string | null}>};

export type GroupReplayTimeline = {
  offsetsByFlightId: Record<string, number[]>;
  durationSeconds: number;
  usesRecordedTime: boolean;
};

function timestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function hasCompleteIncreasingTime(flight: GroupReplayFlight) {
  if (flight.track.length < 2) return false;
  const values = flight.track.map((point) => timestamp(point.time));
  return values.every((value) => value != null) && values.every((value, index) => index === 0 || value! > values[index - 1]!);
}

export function buildGroupReplayTimeline(flights: GroupReplayFlight[]): GroupReplayTimeline {
  if (flights.length === 0) return {offsetsByFlightId: {}, durationSeconds: 0, usesRecordedTime: false};
  const usesRecordedTime = flights.every(hasCompleteIncreasingTime);
  const offsetsByFlightId: Record<string, number[]> = {};
  if (usesRecordedTime) {
    const startMs = Math.min(...flights.map((flight) => timestamp(flight.track[0].time)!));
    for (const flight of flights) offsetsByFlightId[flight.id] = flight.track.map((point) => (timestamp(point.time)! - startMs) / 1000);
  } else {
    for (const flight of flights) offsetsByFlightId[flight.id] = buildReplayTimeline(flight.track).offsets;
  }
  const durationSeconds = Object.values(offsetsByFlightId).reduce(
    (maximum, offsets) => Math.max(maximum, offsets.at(-1) ?? 0),
    0
  );
  return {offsetsByFlightId, durationSeconds, usesRecordedTime};
}

export function groupReplayIndexAtElapsed(offsets: number[], elapsedSeconds: number) {
  if (offsets.length === 0 || elapsedSeconds < offsets[0]) return -1;
  return replayIndexAtElapsed(offsets, elapsedSeconds);
}
