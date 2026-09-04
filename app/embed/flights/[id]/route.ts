import {prisma} from "@/lib/db";
import {buildFlightShareUrls, configuredPublicOrigin, escapeHtml, flightShareDescription, normalizeEmbedLocale} from "@/lib/flight-sharing";
import {PUBLIC_FLIGHT_WHERE} from "@/lib/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const locale = normalizeEmbedLocale(new URL(request.url).searchParams.get("lang"));
  const flight = await prisma.flight.findFirst({where: {...PUBLIC_FLIGHT_WHERE, id}, select: {id: true, title: true, pilotCallsign: true, simulator: true, glider: true, distanceKm: true, olcPoints: true}});
  if (!flight) return new Response("Flight not found.", {status: 404, headers: {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store"}});
  const urls = buildFlightShareUrls(configuredPublicOrigin(), locale, flight.id);
  const title = escapeHtml(flight.title);
  const description = escapeHtml(flightShareDescription(flight, locale));
  const open = locale === "en" ? "Open flight in SimSoar" : "Flug in SimSoar öffnen";
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · SimSoar</title><style>html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc}.card{overflow:hidden;border:1px solid #334155;border-radius:14px;background:#111827}.map{display:block;width:100%;aspect-ratio:16/8;object-fit:cover}.body{padding:18px}.body h1{margin:0 0 8px;font-size:1.35rem}.body p{margin:0 0 16px;color:#cbd5e1}.body a{display:inline-block;border-radius:9px;background:#f97316;color:white;padding:10px 14px;font-weight:700;text-decoration:none}</style></head><body><article class="card"><img class="map" src="${escapeHtml(urls.previewUrl)}" alt=""><div class="body"><h1>${title}</h1><p>${description}</p><a href="${escapeHtml(urls.shareUrl)}" target="_blank" rel="noopener noreferrer">${open}</a></div></article></body></html>`;
  return new Response(html, {headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff"}});
}
