export type LeagueSchedule = {startDayUtc: number; startHourUtc: number; durationHours: number};

export function recurringLeagueWindow(at: Date, schedule: LeagueSchedule) {
  const startDay = Math.max(0, Math.min(6, Math.trunc(schedule.startDayUtc)));
  const startHour = Math.max(0, Math.min(23, Math.trunc(schedule.startHourUtc)));
  const durationHours = Math.max(1, Math.min(168, Math.trunc(schedule.durationHours)));
  const startsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), startHour));
  const daysSinceStart = (startsAt.getUTCDay() - startDay + 7) % 7;
  startsAt.setUTCDate(startsAt.getUTCDate() - daysSinceStart);
  if (startsAt > at) startsAt.setUTCDate(startsAt.getUTCDate() - 7);
  const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);
  return {startsAt, endsAt, contains: at >= startsAt && at < endsAt};
}

export function leagueScore(rule: "OLC_POINTS" | "DISTANCE", flight: {olcPoints: number; distanceKm: number}) {
  return rule === "DISTANCE" ? flight.distanceKm : flight.olcPoints;
}

export function leagueLeaderboard<T extends {userId: string; callsign: string; score: number}>(entries: T[]) {
  const totals = new Map<string, {userId: string; callsign: string; score: number; flights: number}>();
  for (const entry of entries) {
    const total = totals.get(entry.userId) ?? {userId: entry.userId, callsign: entry.callsign, score: 0, flights: 0};
    total.score += entry.score;
    total.flights += 1;
    totals.set(entry.userId, total);
  }
  return [...totals.values()].sort((left, right) => right.score - left.score || left.callsign.localeCompare(right.callsign));
}
