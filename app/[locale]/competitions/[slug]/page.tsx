import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {competitionLeaderboard} from "@/lib/competition-policy";
import {archivePastCompetitions} from "@/lib/competitions";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompetitionPage({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Competitions"});
  await archivePastCompetitions();
  const competition = await prisma.competition.findFirst({
    where: {slug, status: {in: ["ACTIVE", "CLOSED"]}},
    include: {entries: {
      orderBy: {score: "desc"},
      include: {user: {select: {profile: {select: {callsign: true}}}}, flight: {select: {id: true, title: true, simulator: true, competitionClass: true, startTime: true, createdAt: true, distanceKm: true, olcPoints: true}}}
    }}
  });
  if (!competition) notFound();
  const leaderboard = competitionLeaderboard(competition.entries.map((entry) => ({
    userId: entry.userId, callsign: entry.user.profile?.callsign || t("unnamedPilot"), score: entry.score
  })));
  return <main className="wrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader"><div><span className="cardTitle">{competition.name}</span><p className="muted">{competition.description || t("noDescription")}</p></div><Link className="btn btnSecondary" href="/competitions">{t("back")}</Link></div>
      <div className="cardBody competitionMeta"><span>{t(`status_${competition.status}`)}</span><span>{competition.startAt.toLocaleString(locale)} – {competition.endAt.toLocaleString(locale)}</span><span>{t(`scoring_${competition.scoringRule}`)}</span>{competition.simulator ? <span>{t("simulator")}: {competition.simulator}</span> : null}{competition.competitionClass ? <span>{t("class")}: {competition.competitionClass}</span> : null}</div>
      {competition.rules ? <div className="cardBody"><h3>{t("rules")}</h3><p className="flightStoryText">{competition.rules}</p></div> : null}
    </section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("leaderboard")}</span></div><div className="tableWrap"><table>
      <thead><tr><th>{t("rank")}</th><th>{t("pilot")}</th><th>{t("flights")}</th><th>{t("score")}</th></tr></thead>
      <tbody>{leaderboard.length === 0 ? <tr><td colSpan={4} className="emptyTable">{t("noEntries")}</td></tr> : leaderboard.map((pilot, index) => <tr key={pilot.userId}><td><strong>{index + 1}</strong></td><td>{pilot.callsign}</td><td>{pilot.flights}</td><td>{pilot.score.toFixed(1)}</td></tr>)}</tbody>
    </table></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("flightsTitle")}</span></div><div className="tableWrap"><table>
      <thead><tr><th>{t("date")}</th><th>{t("pilot")}</th><th>{t("flight")}</th><th>{t("score")}</th></tr></thead>
      <tbody>{competition.entries.length === 0 ? <tr><td colSpan={4} className="emptyTable">{t("noEntries")}</td></tr> : competition.entries.map((entry) => <tr key={entry.id}><td>{(entry.flight.startTime || entry.flight.createdAt).toLocaleDateString(locale)}</td><td>{entry.user.profile?.callsign || t("unnamedPilot")}</td><td><Link href={`/flights/${entry.flight.id}`}>{entry.flight.title}</Link></td><td>{entry.score.toFixed(1)}</td></tr>)}</tbody>
    </table></div></section>
  </main>;
}
