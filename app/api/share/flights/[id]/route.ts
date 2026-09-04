import {prisma} from "@/lib/db";
import {simplifyFlightTrack} from "@/lib/flight-map";
import {buildFlightPreviewPolyline, escapeHtml} from "@/lib/flight-sharing";
import {PUBLIC_FLIGHT_WHERE} from "@/lib/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const flight = await prisma.flight.findFirst({where: {...PUBLIC_FLIGHT_WHERE, id}, select: {title: true, pilotCallsign: true, distanceKm: true, track: {orderBy: {seq: "asc"}, select: {lat: true, lon: true}}}});
  if (!flight) return new Response("Not found", {status: 404, headers: {"Cache-Control": "private, no-store"}});
  const points = buildFlightPreviewPolyline(simplifyFlightTrack(flight.track, 180));
  const title = escapeHtml(flight.title);
  const pilot = escapeHtml(flight.pilotCallsign);
  const route = points ? `<polyline points="${points}" fill="none" stroke="#f97316" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points.split(" ")[0].split(",")[0]}" cy="${points.split(" ")[0].split(",")[1]}" r="12" fill="#22c55e"/><circle cx="${points.split(" ").at(-1)!.split(",")[0]}" cy="${points.split(" ").at(-1)!.split(",")[1]}" r="12" fill="#ef4444"/>` : `<text x="560" y="280" text-anchor="middle" fill="#94a3b8" font-size="28">No route data</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="630" viewBox="0 0 1120 630"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#1e3a5f"/></linearGradient><pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="#334155" stroke-width="1"/></pattern></defs><rect width="1120" height="630" rx="28" fill="url(#bg)"/><rect width="1120" height="630" rx="28" fill="url(#grid)" opacity=".65"/><g transform="translate(0 35)">${route}</g><rect y="520" width="1120" height="110" fill="#020617" opacity=".88"/><text x="48" y="566" fill="#fff" font-family="system-ui,sans-serif" font-size="30" font-weight="700">${title}</text><text x="48" y="604" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="23">${pilot} · ${flight.distanceKm.toFixed(1)} km · SimSoar</text></svg>`;
  return new Response(svg, {headers: {"Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox", "X-Content-Type-Options": "nosniff"}});
}
