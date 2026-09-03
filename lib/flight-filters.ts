import type {Prisma} from "@prisma/client";

export type FlightFilterInput = Record<
  string,
  string | string[] | undefined
>;

export type FlightFilters = {
  search: string;
  simulator: string;
  glider: string;
  competitionClass: string;
  dateFrom: Date | null;
  dateToExclusive: Date | null;
  distanceMin: number | null;
  distanceMax: number | null;
  pointsMin: number | null;
  pointsMax: number | null;
  speedMin: number | null;
  speedMax: number | null;
  altitudeMin: number | null;
  altitudeMax: number | null;
};

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function textValue(value: string | string[] | undefined): string {
  return firstValue(value).slice(0, 120);
}

function numberValue(value: string | string[] | undefined): number | null {
  const raw = firstValue(value);

  if (!raw) return null;

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function dateValue(value: string | string[] | undefined): Date | null {
  const raw = firstValue(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const parsed = new Date(`${raw}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
    ? null
    : parsed;
}

function nextUtcDay(value: Date | null): Date | null {
  if (!value) return null;

  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

export function parseFlightFilters(input: FlightFilterInput): FlightFilters {
  return {
    search: textValue(input.search),
    simulator: textValue(input.simulator),
    glider: textValue(input.glider),
    competitionClass: textValue(input.competitionClass),
    dateFrom: dateValue(input.dateFrom),
    dateToExclusive: nextUtcDay(dateValue(input.dateTo)),
    distanceMin: numberValue(input.distanceMin),
    distanceMax: numberValue(input.distanceMax),
    pointsMin: numberValue(input.pointsMin),
    pointsMax: numberValue(input.pointsMax),
    speedMin: numberValue(input.speedMin),
    speedMax: numberValue(input.speedMax),
    altitudeMin: numberValue(input.altitudeMin),
    altitudeMax: numberValue(input.altitudeMax)
  };
}

function numericRange(
  min: number | null,
  max: number | null
): {gte?: number; lte?: number} | undefined {
  if (min === null && max === null) return undefined;

  return {
    ...(min !== null ? {gte: min} : {}),
    ...(max !== null ? {lte: max} : {})
  };
}

export function buildFlightWhere(
  filters: FlightFilters
): Prisma.FlightWhereInput {
  return {
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    deletedAt: null,
    ...(filters.search
      ? {
          OR: [
            {
              pilotCallsign: {
                contains: filters.search,
                mode: "insensitive" as const
              }
            },
            {
              user: {
                name: {
                  contains: filters.search,
                  mode: "insensitive" as const
                }
              }
            }
          ]
        }
      : {}),
    ...(filters.simulator
      ? {
          simulator: {
            contains: filters.simulator,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(filters.glider
      ? {
          glider: {
            contains: filters.glider,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(filters.competitionClass
      ? {
          competitionClass: {
            contains: filters.competitionClass,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(filters.dateFrom || filters.dateToExclusive
      ? {
          startTime: {
            ...(filters.dateFrom ? {gte: filters.dateFrom} : {}),
            ...(filters.dateToExclusive ? {lt: filters.dateToExclusive} : {})
          }
        }
      : {}),
    ...(numericRange(filters.distanceMin, filters.distanceMax)
      ? {distanceKm: numericRange(filters.distanceMin, filters.distanceMax)}
      : {}),
    ...(numericRange(filters.pointsMin, filters.pointsMax)
      ? {olcPoints: numericRange(filters.pointsMin, filters.pointsMax)}
      : {}),
    ...(numericRange(filters.speedMin, filters.speedMax)
      ? {avgSpeedKmh: numericRange(filters.speedMin, filters.speedMax)}
      : {}),
    ...(numericRange(filters.altitudeMin, filters.altitudeMax)
      ? {maxAltitudeM: numericRange(filters.altitudeMin, filters.altitudeMax)}
      : {})
  };
}

export function hasActiveFlightFilters(filters: FlightFilters): boolean {
  return Object.values(filters).some((value) =>
    value instanceof Date ? true : value !== null && value !== ""
  );
}
