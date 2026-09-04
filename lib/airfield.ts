const ICAO_CODE_PATTERN = /^[A-Za-z]{4}$/;
const COORDINATE_PAIR_PATTERN =
  /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,;]\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/;

export type HomeAirfieldLocation =
  | {
      kind: "coordinates";
      lat: number;
      lon: number;
      label: string;
    }
  | {
      kind: "search";
      query: string;
      label: string;
    };

export function isIcaoCode(value: string | null | undefined): boolean {
  return ICAO_CODE_PATTERN.test(value?.trim() ?? "");
}

export function parseHomeAirfieldCoordinates(
  value: string | null | undefined
): {lat: number; lon: number} | null {
  const match = value?.trim().match(COORDINATE_PAIR_PATTERN);

  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lon = Number(match[2]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return {lat, lon};
}

export function normalizeHomeAirfield(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (isIcaoCode(trimmed)) {
    return trimmed.toUpperCase();
  }

  const coordinates = parseHomeAirfieldCoordinates(trimmed);

  if (coordinates) {
    return `${coordinates.lat}, ${coordinates.lon}`;
  }

  return trimmed;
}

export function homeAirfieldSearchQuery(
  value: string | null | undefined
): string {
  const normalized = normalizeHomeAirfield(value);

  if (!normalized) {
    return "";
  }

  return isIcaoCode(normalized)
    ? `${normalized} airport`
    : normalized;
}

export function resolveHomeAirfieldLocation(
  value: string | null | undefined
): HomeAirfieldLocation | null {
  const normalized = normalizeHomeAirfield(value);

  if (!normalized) {
    return null;
  }

  const coordinates = parseHomeAirfieldCoordinates(normalized);

  if (coordinates) {
    return {
      kind: "coordinates",
      ...coordinates,
      label: normalized
    };
  }

  return {
    kind: "search",
    query: homeAirfieldSearchQuery(normalized),
    label: normalized
  };
}
