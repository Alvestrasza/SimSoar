const ICAO_CODE_PATTERN = /^[A-Za-z]{4}$/;

export function isIcaoCode(value: string | null | undefined): boolean {
  return ICAO_CODE_PATTERN.test(value?.trim() ?? "");
}

export function normalizeHomeAirfield(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  return isIcaoCode(trimmed) ? trimmed.toUpperCase() : trimmed;
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
