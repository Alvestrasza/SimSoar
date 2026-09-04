import "server-only";
import {prisma} from "./db";

export const SIM2REAL_AIRSPACE_QUERY_LIMIT = 2000;

export function taskBounds(waypoints: Array<{lat: number; lon: number}>) {
  return waypoints.reduce((bounds, point) => ({minLat: Math.min(bounds.minLat, point.lat), maxLat: Math.max(bounds.maxLat, point.lat), minLon: Math.min(bounds.minLon, point.lon), maxLon: Math.max(bounds.maxLon, point.lon)}), {minLat: 90, maxLat: -90, minLon: 180, maxLon: -180});
}

export async function loadRelevantAirspaces(waypoints: Array<{lat: number; lon: number}>) {
  const bounds = taskBounds(waypoints);
  const rows = await prisma.airspace.findMany({
    where: {active: true, minLat: {lte: bounds.maxLat}, maxLat: {gte: bounds.minLat}, minLon: {lte: bounds.maxLon}, maxLon: {gte: bounds.minLon}},
    orderBy: {createdAt: "desc"},
    take: SIM2REAL_AIRSPACE_QUERY_LIMIT + 1,
    include: {points: {orderBy: {seq: "asc"}, select: {lat: true, lon: true}}}
  });
  return {airspaces: rows.slice(0, SIM2REAL_AIRSPACE_QUERY_LIMIT), truncated: rows.length > SIM2REAL_AIRSPACE_QUERY_LIMIT};
}

export function configuredBriefingLinks() {
  const defaults = [{label: "EASA AIS and NOTAM resources", url: "https://www.easa.europa.eu/en/domains/air-operations/flight-operations/notice-airmen-notam"}];
  try {
    const value: unknown = JSON.parse(process.env.SIMSOAR_BRIEFING_LINKS_JSON || "null");
    if (!Array.isArray(value)) return defaults;
    const links = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const {label, url} = item as Record<string, unknown>;
      if (typeof label !== "string" || typeof url !== "string" || label.length > 100 || url.length > 500) return [];
      try { const parsed = new URL(url); return parsed.protocol === "https:" ? [{label, url: parsed.toString()}] : []; } catch { return []; }
    }).slice(0, 20);
    return links.length ? links : defaults;
  } catch { return defaults; }
}
