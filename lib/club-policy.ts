const NON_SLUG_CHARACTERS = /[^a-z0-9]+/g;

export function normalizePublicSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(NON_SLUG_CHARACTERS, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const normalizeClubSlug = normalizePublicSlug;

export function clubRanking<T extends {callsign: string; flights: Array<{distanceKm: number; olcPoints: number}>}>(members: T[]) {
  return members.map((member) => ({
    ...member,
    flightsCount: member.flights.length,
    totalDistanceKm: member.flights.reduce((sum, flight) => sum + flight.distanceKm, 0),
    totalOlcPoints: member.flights.reduce((sum, flight) => sum + flight.olcPoints, 0)
  })).sort((left, right) =>
    right.totalOlcPoints - left.totalOlcPoints ||
    right.totalDistanceKm - left.totalDistanceKm ||
    left.callsign.localeCompare(right.callsign)
  );
}
