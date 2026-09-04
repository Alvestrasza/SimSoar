export const FLIGHT_COMPARISON_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#dc2626"] as const;

export function normalizeComparisonIds(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((id) => id.trim()).filter(Boolean))].slice(0, 5);
}

export function canCompareFlights(ids: string[]) {
  return ids.length >= 2 && ids.length <= 5;
}

export function formatComparisonDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor(safe % 3600 / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
