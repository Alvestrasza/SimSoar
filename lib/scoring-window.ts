import {scoringDistanceKm, type ScoringTrackPoint} from "./scoring.ts";

export type ScoringWindowPoint = ScoringTrackPoint & {
  secondsOfDay: number;
  altM: number;
};

export type DetectedScoringWindow = {
  startIndex: number;
  endIndex: number;
  startSeq: number;
  endSeq: number;
  reasons: string[];
};

const MAX_CONTIGUOUS_GAP_SECONDS = 120;
const MIN_MOVING_SPEED_KMH = 10;
const MIN_LAUNCH_CLIMB_METERS = 150;
const MAX_LAUNCH_PHASE_SECONDS = 30 * 60;

function secondsDelta(current: number, previous: number): number {
  const delta = current - previous;
  return delta < 0 ? delta + 86400 : delta;
}

function groundSpeedKmh(a: ScoringWindowPoint, b: ScoringWindowPoint): number {
  const seconds = secondsDelta(b.secondsOfDay, a.secondsOfDay);
  return seconds > 0 ? scoringDistanceKm(a, b) / (seconds / 3600) : 0;
}

function segmentDistance(points: ScoringWindowPoint[], start: number, end: number): number {
  let distance = 0;
  for (let index = start + 1; index <= end; index += 1) {
    distance += scoringDistanceKm(points[index - 1], points[index]);
  }
  return distance;
}

export function detectScoringWindow(points: ScoringWindowPoint[]): DetectedScoringWindow {
  if (points.length < 2) {
    throw new Error("At least two track points are required for a scoring window.");
  }

  const segments: Array<{start: number; end: number}> = [];
  let segmentStart = 0;
  for (let index = 1; index < points.length; index += 1) {
    const gap = secondsDelta(points[index].secondsOfDay, points[index - 1].secondsOfDay);
    if (gap <= 0 || gap > MAX_CONTIGUOUS_GAP_SECONDS) {
      segments.push({start: segmentStart, end: index - 1});
      segmentStart = index;
    }
  }
  segments.push({start: segmentStart, end: points.length - 1});

  let selected = segments[0];
  let selectedDistance = segmentDistance(points, selected.start, selected.end);
  for (const segment of segments.slice(1)) {
    const distance = segmentDistance(points, segment.start, segment.end);
    if (distance > selectedDistance) {
      selected = segment;
      selectedDistance = distance;
    }
  }

  const reasons: string[] = segments.length > 1 ? ["track-gap"] : [];
  let startIndex = selected.start;
  let endIndex = selected.end;

  while (
    startIndex < endIndex &&
    groundSpeedKmh(points[startIndex], points[startIndex + 1]) < MIN_MOVING_SPEED_KMH
  ) {
    startIndex += 1;
  }
  while (
    endIndex > startIndex &&
    groundSpeedKmh(points[endIndex - 1], points[endIndex]) < MIN_MOVING_SPEED_KMH
  ) {
    endIndex -= 1;
  }
  if (startIndex !== selected.start || endIndex !== selected.end) {
    reasons.push("stationary-trim");
  }

  const initialAltitude = points[startIndex].altM;
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const elapsed = secondsDelta(points[index].secondsOfDay, points[startIndex].secondsOfDay);
    if (elapsed > MAX_LAUNCH_PHASE_SECONDS) break;
    if (points[index].altM - initialAltitude < MIN_LAUNCH_CLIMB_METERS) continue;

    let lookAhead = index + 1;
    while (
      lookAhead <= endIndex &&
      secondsDelta(points[lookAhead].secondsOfDay, points[index].secondsOfDay) < 60
    ) {
      lookAhead += 1;
    }
    if (lookAhead > endIndex) break;

    const lookAheadSeconds = secondsDelta(points[lookAhead].secondsOfDay, points[index].secondsOfDay);
    const followingClimb = (points[lookAhead].altM - points[index].altM) / lookAheadSeconds;
    if (followingClimb <= 0.2) {
      startIndex = index;
      reasons.push("launch-climb");
      break;
    }
  }

  if (endIndex <= startIndex) {
    startIndex = 0;
    endIndex = points.length - 1;
    reasons.push("fallback-full-segment");
  }

  return {
    startIndex,
    endIndex,
    startSeq: points[startIndex].seq,
    endSeq: points[endIndex].seq,
    reasons
  };
}
