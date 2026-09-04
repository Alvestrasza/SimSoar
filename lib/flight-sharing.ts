export type ShareableFlight = {
  id: string;
  title: string;
  pilotCallsign: string;
  simulator: string;
  glider: string | null;
  distanceKm: number;
  olcPoints: number;
};

export function configuredPublicOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported public URL protocol.");
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function normalizeEmbedLocale(value: string | null) {
  return value === "en" ? "en" : "de";
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character]!);
}

export function flightShareDescription(flight: ShareableFlight, locale: "de" | "en") {
  const aircraft = flight.glider ? ` · ${flight.glider}` : "";
  return locale === "en"
    ? `${flight.pilotCallsign} · ${flight.simulator}${aircraft} · ${flight.distanceKm.toFixed(1)} km · ${flight.olcPoints.toFixed(1)} OLC points`
    : `${flight.pilotCallsign} · ${flight.simulator}${aircraft} · ${flight.distanceKm.toFixed(1)} km · ${flight.olcPoints.toFixed(1)} OLC-Punkte`;
}

export function buildFlightPreviewPolyline(points: Array<{lat: number; lon: number}>, width = 1120, height = 560, padding = 56) {
  const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (valid.length < 2) return "";
  let minLat = valid[0].lat;
  let maxLat = valid[0].lat;
  let minLon = valid[0].lon;
  let maxLon = valid[0].lon;
  for (const point of valid) {
    minLat = Math.min(minLat, point.lat); maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon); maxLon = Math.max(maxLon, point.lon);
  }
  const latRange = Math.max(maxLat - minLat, 0.000001);
  const lonRange = Math.max(maxLon - minLon, 0.000001);
  return valid.map((point) => {
    const x = padding + ((point.lon - minLon) / lonRange) * (width - padding * 2);
    const y = padding + ((maxLat - point.lat) / latRange) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function buildFlightShareUrls(origin: string, locale: "de" | "en", flightId: string) {
  const encodedId = encodeURIComponent(flightId);
  return {
    shareUrl: `${origin}/${locale}/flights/${encodedId}`,
    embedUrl: `${origin}/embed/flights/${encodedId}?lang=${locale}`,
    previewUrl: `${origin}/api/share/flights/${encodedId}`
  };
}
