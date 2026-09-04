export type CompetitionRule = {
  startAt: Date;
  endAt: Date;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  simulator: string | null;
  competitionClass: string | null;
  scoringRule: "OLC_POINTS" | "DISTANCE";
};

export type CompetitionFlight = {
  startTime: Date | null;
  createdAt: Date;
  simulator: string;
  competitionClass: string | null;
  distanceKm: number;
  olcPoints: number;
};

function normalized(value: string | null) {
  return value?.trim().toLocaleLowerCase("en") || null;
}

export function competitionFlightDate(flight: CompetitionFlight) {
  return flight.startTime ?? flight.createdAt;
}

export function matchesCompetition(competition: CompetitionRule, flight: CompetitionFlight) {
  const date = competitionFlightDate(flight);
  return competition.status === "ACTIVE" &&
    date >= competition.startAt && date <= competition.endAt &&
    (!competition.simulator || normalized(competition.simulator) === normalized(flight.simulator)) &&
    (!competition.competitionClass || normalized(competition.competitionClass) === normalized(flight.competitionClass));
}

export function competitionFlightScore(competition: Pick<CompetitionRule, "scoringRule">, flight: CompetitionFlight) {
  return competition.scoringRule === "DISTANCE" ? flight.distanceKm : flight.olcPoints;
}

export function competitionLeaderboard<T extends {userId: string; callsign: string; score: number}>(entries: T[]) {
  const pilots = new Map<string, {userId: string; callsign: string; score: number; flights: number}>();
  for (const entry of entries) {
    const current = pilots.get(entry.userId) ?? {userId: entry.userId, callsign: entry.callsign, score: 0, flights: 0};
    current.score += entry.score;
    current.flights += 1;
    pilots.set(entry.userId, current);
  }
  return [...pilots.values()].sort((left, right) => right.score - left.score || left.callsign.localeCompare(right.callsign));
}
