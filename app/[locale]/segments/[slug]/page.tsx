import {notFound} from "next/navigation";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {segmentLeaderboard} from "@/lib/segment-policy";
import TaskComparisonMap from "@/app/components/TaskComparisonMap";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export default async function SegmentPage({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params; setRequestLocale(locale);
  const [t, segment] = await Promise.all([getTranslations({locale, namespace: "Segments"}), prisma.flightSegment.findUnique({where: {slug}, include: {results: {orderBy: {durationSeconds: "asc"}, take: 100, include: {flight: {select: {id: true, title: true}}, user: {select: {name: true, profile: {select: {callsign: true}}}}}}}})]);
  if (!segment?.active) notFound();
  const ranking = segmentLeaderboard(segment.results);
  return <main className="wrap"><section className="card"><div className="cardHead"><div><Link href="/segments">← {t("back")}</Link><h1>{segment.name}</h1><p className="muted">{segment.description || t("noDescription")}</p></div></div><TaskComparisonMap task={[{name: t("start"), lat: segment.startLat, lon: segment.startLon, radiusM: segment.gateRadiusM}, {name: t("finish"), lat: segment.finishLat, lon: segment.finishLon, radiusM: segment.gateRadiusM}]} /></section>
  <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("ranking")}</span></div><div className="tableWrap"><table><thead><tr><th>{t("rank")}</th><th>{t("pilot")}</th><th>{t("time")}</th><th>{t("flight")}</th><th>{t("date")}</th></tr></thead><tbody>{ranking.length === 0 ? <tr><td className="emptyTable" colSpan={5}>{t("noResults")}</td></tr> : ranking.map((result, index) => <tr key={result.id}><td><strong>{index + 1}</strong></td><td>{result.user.profile?.callsign || result.user.name || t("unknownPilot")}</td><td>{formatDuration(result.durationSeconds)}</td><td><Link href={`/flights/${result.flight.id}`}>{result.flight.title}</Link></td><td>{result.completedAt?.toLocaleString(locale) ?? "—"}</td></tr>)}</tbody></table></div></section></main>;
}
