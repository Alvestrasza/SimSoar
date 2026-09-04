export const BADGE_CODES = [
  "FIRST_FLIGHT",
  "DISTANCE_100",
  "DISTANCE_300",
  "DISTANCE_500",
  "BEST_THERMAL",
  "WEEKLY_ACTIVITY"
] as const;

export type BadgeCode = typeof BADGE_CODES[number];

export type BadgeFlight = {
  distanceKm: number;
  createdAt: Date;
  thermals: Array<{maxClimbMs: number}>;
};

export function evaluateBadgeCodes(flights: BadgeFlight[], now = new Date()): BadgeCode[] {
  const earned = new Set<BadgeCode>();
  if (flights.length > 0) earned.add("FIRST_FLIGHT");
  if (flights.some((flight) => flight.distanceKm >= 100)) earned.add("DISTANCE_100");
  if (flights.some((flight) => flight.distanceKm >= 300)) earned.add("DISTANCE_300");
  if (flights.some((flight) => flight.distanceKm >= 500)) earned.add("DISTANCE_500");
  if (flights.some((flight) => flight.thermals.some((thermal) => thermal.maxClimbMs >= 5))) earned.add("BEST_THERMAL");

  const weeklyStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const activeDays = new Set(flights
    .filter((flight) => flight.createdAt.getTime() >= weeklyStart && flight.createdAt <= now)
    .map((flight) => flight.createdAt.toISOString().slice(0, 10)));
  if (activeDays.size >= 3) earned.add("WEEKLY_ACTIVITY");
  return BADGE_CODES.filter((code) => earned.has(code));
}

export function pilotLevel(badgeCount: number) {
  if (badgeCount >= 6) return "LEGEND" as const;
  if (badgeCount >= 3) return "ACHIEVER" as const;
  if (badgeCount >= 1) return "EXPLORER" as const;
  return "ROOKIE" as const;
}
