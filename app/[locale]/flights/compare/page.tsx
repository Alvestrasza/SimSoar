import {prisma} from "@/lib/db";
import {Link} from "@/i18n/navigation";
import {canCompareFlights, FLIGHT_COMPARISON_COLORS, formatComparisonDuration, normalizeComparisonIds} from "@/lib/flight-comparison";
import FlightCompareSelector from "@/app/components/FlightCompareSelector";
import FlightComparisonMap from "@/app/components/FlightComparisonMap";
import FlightComparisonAltitudeChart from "@/app/components/FlightComparisonAltitudeChart";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function FlightComparisonPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{id?: string | string[]}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]); setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "FlightComparison"});
  const ids = normalizeComparisonIds(query.id);
  const visibleWhere = {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null} as const;
  const candidates = await prisma.flight.findMany({where: visibleWhere, orderBy: {createdAt: "desc"}, take: 100, select: {id: true, title: true, pilotCallsign: true, simulator: true, glider: true, createdAt: true}});
  const selectedRows = canCompareFlights(ids) ? await prisma.flight.findMany({where: {...visibleWhere, id: {in: ids}}, include: {track: {orderBy: {seq: "asc"}}}}) : [];
  const rowById = new Map(selectedRows.map((flight) => [flight.id, flight]));
  const flights = ids.map((id) => rowById.get(id)).filter((flight): flight is NonNullable<typeof flight> => Boolean(flight));
  const ready = canCompareFlights(flights.map((flight) => flight.id));

  return <main className="wrap">
    <div className="sectionHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div><Link className="btn btnSecondary" href="/flights">{t("back")}</Link></div>
    <FlightCompareSelector flights={candidates.map((flight) => ({...flight, createdAt: flight.createdAt.toISOString()}))} initialIds={flights.map((flight) => flight.id)} />
    {!ready ? <section className="card comparisonHint"><p>{t("selectionHint")}</p><p className="muted">{t("similarHint")}</p></section> : <>
      <section className="card comparisonSection"><div className="cardHead"><span className="cardTitle">{t("mapTitle")}</span></div><FlightComparisonMap flights={flights.map((flight) => ({id: flight.id, title: flight.title, pilotCallsign: flight.pilotCallsign, track: flight.track}))} /><div className="comparisonLegend">{flights.map((flight, index) => <span key={flight.id}><i style={{background: FLIGHT_COMPARISON_COLORS[index]}} />{flight.pilotCallsign} · {flight.title}</span>)}</div></section>
      <section className="card comparisonSection"><div className="cardHead"><span className="cardTitle">{t("metricsTitle")}</span></div><div className="tableWrap"><table><thead><tr><th>{t("flight")}</th><th>{t("simulator")}</th><th>{t("glider")}</th><th>{t("distance")}</th><th>{t("olc")}</th><th>{t("speed")}</th><th>{t("duration")}</th><th>{t("altitude")}</th><th>{t("climb")}</th></tr></thead><tbody>{flights.map((flight, index) => <tr key={flight.id}><td><span className="comparisonFlightName"><i style={{background: FLIGHT_COMPARISON_COLORS[index]}} /><Link href={`/flights/${flight.id}`}><strong>{flight.pilotCallsign}</strong><br /><small>{flight.title}</small></Link></span></td><td>{flight.simulator}</td><td>{flight.glider || "—"}</td><td>{flight.distanceKm.toFixed(1)} km</td><td>{flight.olcPoints.toFixed(1)}</td><td>{flight.avgSpeedKmh.toFixed(1)} km/h</td><td>{formatComparisonDuration(flight.durationSeconds)} h</td><td>{flight.maxAltitudeM} m</td><td>{flight.maxVarioMs.toFixed(1)} m/s</td></tr>)}</tbody></table></div></section>
      <section className="card comparisonSection"><div className="cardHead"><div><span className="cardTitle">{t("altitudeTitle")}</span><p className="muted">{t("altitudeHint")}</p></div></div><div className="cardBody"><FlightComparisonAltitudeChart flights={flights.map((flight) => ({id: flight.id, track: flight.track}))} /></div></section>
    </>}
  </main>;
}
