export type ScoringTrackPoint = {
  seq: number;
  lat: number;
  lon: number;
};

export type StoredScoringPoint = ScoringTrackPoint & {
  order: number;
  legDistanceKm: number;
};

export type ScoringResult = {
  ruleId: string;
  distanceKm: number;
  multiplier: number;
  score: number;
  isClosedCourse: boolean;
  points: StoredScoringPoint[];
};

export type ScoringRule = {
  id: string;
  maxLegs: number;
  pointsPerKm: number;
  closedCourseMultiplier: number;
  minimumClosedCourseKm: number;
  maximumCandidatePoints: number;
};

export const SIMSOAR_XC_V1: ScoringRule = Object.freeze({
  id: "SIMSOAR_XC_V1",
  maxLegs: 6,
  pointsPerKm: 1,
  closedCourseMultiplier: 1.2,
  minimumClosedCourseKm: 10,
  maximumCandidatePoints: 300
});

export const SCORING_RULES: Readonly<Record<string, ScoringRule>> = Object.freeze({
  [SIMSOAR_XC_V1.id]: SIMSOAR_XC_V1
});

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function scoringDistanceKm(a: ScoringTrackPoint, b: ScoringTrackPoint): number {
  const earthRadiusKm = 6371;
  const latitude1 = a.lat * Math.PI / 180;
  const latitude2 = b.lat * Math.PI / 180;
  const latitudeDelta = (b.lat - a.lat) * Math.PI / 180;
  const longitudeDelta = (b.lon - a.lon) * Math.PI / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function scoringCandidates(
  points: ScoringTrackPoint[],
  maximumCandidatePoints: number
): ScoringTrackPoint[] {
  if (points.length <= maximumCandidatePoints) {
    return points;
  }

  const candidates: ScoringTrackPoint[] = [];
  for (let index = 0; index < maximumCandidatePoints; index += 1) {
    const sourceIndex = Math.round(index * (points.length - 1) / (maximumCandidatePoints - 1));
    const point = points[sourceIndex];
    if (candidates.at(-1)?.seq !== point.seq) {
      candidates.push(point);
    }
  }
  return candidates;
}

export function calculateScore(
  track: ScoringTrackPoint[],
  rule: ScoringRule = SIMSOAR_XC_V1
): ScoringResult {
  if (track.length < 2) {
    throw new Error("At least two track points are required for scoring.");
  }

  const candidates = scoringCandidates(track, rule.maximumCandidatePoints);
  const legCount = Math.min(rule.maxLegs, candidates.length - 1);
  const distance = Array.from({length: legCount + 1}, () =>
    Array<number>(candidates.length).fill(Number.NEGATIVE_INFINITY)
  );
  const previous = Array.from({length: legCount + 1}, () =>
    Array<number>(candidates.length).fill(-1)
  );
  distance[0][0] = 0;

  for (let leg = 1; leg <= legCount; leg += 1) {
    for (let end = leg; end < candidates.length; end += 1) {
      for (let start = leg - 1; start < end; start += 1) {
        if (!Number.isFinite(distance[leg - 1][start])) continue;
        const candidateDistance =
          distance[leg - 1][start] + scoringDistanceKm(candidates[start], candidates[end]);
        if (candidateDistance > distance[leg][end]) {
          distance[leg][end] = candidateDistance;
          previous[leg][end] = start;
        }
      }
    }
  }

  const routeIndexes = [candidates.length - 1];
  let current = candidates.length - 1;
  for (let leg = legCount; leg > 0; leg -= 1) {
    current = previous[leg][current];
    routeIndexes.push(current);
  }
  routeIndexes.reverse();

  const routeDistanceKm = distance[legCount][candidates.length - 1];
  const closureDistanceKm = scoringDistanceKm(candidates[0], candidates.at(-1)!);
  const closureLimitKm = Math.max(1, routeDistanceKm * 0.05);
  const isClosedCourse =
    routeDistanceKm >= rule.minimumClosedCourseKm && closureDistanceKm <= closureLimitKm;
  const multiplier = rule.pointsPerKm * (isClosedCourse ? rule.closedCourseMultiplier : 1);
  const selected = routeIndexes.map((index) => candidates[index]);

  return {
    ruleId: rule.id,
    distanceKm: round(routeDistanceKm),
    multiplier: round(multiplier, 3),
    score: round(routeDistanceKm * multiplier),
    isClosedCourse,
    points: selected.map((point, order) => ({
      ...point,
      order,
      legDistanceKm: order === 0 ? 0 : round(scoringDistanceKm(selected[order - 1], point))
    }))
  };
}
