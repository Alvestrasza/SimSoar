export type ThermalSortMode = "strength" | "gain";

export function sortThermals<T extends {avgClimbMs: number; gainM: number; seq: number}>(
  thermals: readonly T[],
  mode: ThermalSortMode
): T[] {
  return [...thermals].sort((a, b) => {
    const primary = mode === "gain"
      ? b.gainM - a.gainM
      : b.avgClimbMs - a.avgClimbMs;
    return primary || a.seq - b.seq;
  });
}
