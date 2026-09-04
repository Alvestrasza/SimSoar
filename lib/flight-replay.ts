export type ReplayTrackPoint = {
  seq: number;
  time?: Date | string | null;
};

export type ReplayTimeline = {
  offsets: number[];
  durationSeconds: number;
  usesRecordedTime: boolean;
};

function milliseconds(value: Date | string | null | undefined) {
  if (!value) return null;
  const result = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function buildReplayTimeline(track: ReplayTrackPoint[]): ReplayTimeline {
  if (track.length === 0) return {offsets: [], durationSeconds: 0, usesRecordedTime: false};
  const offsets = [0];
  let recordedIntervals = 0;
  for (let index = 1; index < track.length; index += 1) {
    const previousTime = milliseconds(track[index - 1].time);
    const currentTime = milliseconds(track[index].time);
    const recordedDelta = previousTime != null && currentTime != null ? (currentTime - previousTime) / 1000 : 0;
    const delta = recordedDelta > 0 ? recordedDelta : 1;
    if (recordedDelta > 0) recordedIntervals += 1;
    offsets.push(offsets[index - 1] + delta);
  }
  return {
    offsets,
    durationSeconds: offsets.at(-1) ?? 0,
    usesRecordedTime: recordedIntervals === track.length - 1
  };
}

export function replayIndexAtElapsed(offsets: number[], elapsedSeconds: number) {
  if (offsets.length === 0) return -1;
  const elapsed = Math.max(0, elapsedSeconds);
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= elapsed) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function activeThermalAtSequence<T extends {startSeq?: number | null; endSeq?: number | null}>(thermals: T[], sequence: number | undefined) {
  if (sequence == null) return null;
  return thermals.find((thermal) => thermal.startSeq != null && thermal.endSeq != null && sequence >= thermal.startSeq && sequence <= thermal.endSeq) ?? null;
}
