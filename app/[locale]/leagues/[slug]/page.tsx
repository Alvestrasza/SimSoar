import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {leagueLeaderboard} from "@/lib/league-policy";
import {ensureLeagueRounds} from "@/lib/leagues";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeaguePage({params, searchParams}: {
  params: Promise<{locale: string; slug: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale, slug} = await params; setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Leagues"});
  await ensureLeagueRounds();
  const [query, league] = await Promise.all([
    searchParams,
    prisma.league.findFirst({where: {slug, active: true}, include: {club: {select: {name: true, slug: true}}, rounds: {orderBy: {startsAt: "desc"}, take: 30}}})
  ]);
  if (!league) notFound();
  const requestedRoundId = Array.isArray(query.round) ? query.round[0] : query.round;
  const selectedSummary = league.rounds.find((round) => round.id === requestedRoundId) || league.rounds.find((round) => round.status === "ACTIVE") || league.rounds[0];
  const round = selectedSummary ? await prisma.leagueRound.findUnique({
    where: {id: selectedSummary.id},
    include: {entries: {orderBy: {score: "desc"}, include: {user: {select: {profile: {select: {callsign: true}}}}, flight: {select: {id: true, title: true, startTime: true, createdAt: true}}}}}
  }) : null;
  const leaderboard = round ? leagueLeaderboard(round.entries.map((entry) => ({userId: entry.userId, callsign: entry.user.profile?.callsign || t("unnamedPilot"), score: entry.score}))) : [];
  return <main className="wrap">
    <section className="card"><div className="cardHead adminFlightsHeader"><div><span className="cardTitle">{league.name}</span><p className="muted">{league.description || t("noDescription")}</p></div><Link className="btn btnSecondary" href="/leagues">{t("back")}</Link></div><div className="cardBody competitionMeta"><span>{t(`mode_${league.mode}`)}</span><span>{t(`scoring_${league.scoringRule}`)}</span><span>{league.scope === "GLOBAL" ? t("global") : t("clubScope")}{league.club ? `: ${league.club.name}` : ""}</span><span>{t("schedule", {day: t(`day_${league.startDayUtc}`), hour: league.startHourUtc, duration: league.durationHours})}</span></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("roundsTitle")}</span></div><div className="cardBody leagueRoundLinks">{league.rounds.length === 0 ? <p className="muted">{t("noRounds")}</p> : league.rounds.map((item) => <Link className={`btn ${item.id === round?.id ? "btnPrimary" : "btnSecondary"}`} href={`/leagues/${league.slug}?round=${item.id}`} key={item.id}>{item.startsAt.toLocaleDateString(locale)} · {t(`status_${item.status}`)}</Link>)}</div></section>
    {round ? <><section className="card" style={{marginTop: 20}}><div className="cardHead"><div><span className="cardTitle">{t("leaderboard")}</span><p className="muted">{round.startsAt.toLocaleString(locale)} – {round.endsAt.toLocaleString(locale)}</p></div></div><div className="tableWrap"><table><thead><tr><th>{t("rank")}</th><th>{t("pilot")}</th><th>{t("flights")}</th><th>{t("score")}</th></tr></thead><tbody>{leaderboard.length === 0 ? <tr><td colSpan={4} className="emptyTable">{t("noEntries")}</td></tr> : leaderboard.map((pilot, index) => <tr key={pilot.userId}><td><strong>{index + 1}</strong></td><td>{pilot.callsign}</td><td>{pilot.flights}</td><td>{pilot.score.toFixed(1)}</td></tr>)}</tbody></table></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("flightsTitle")}</span></div><div className="tableWrap"><table><thead><tr><th>{t("date")}</th><th>{t("pilot")}</th><th>{t("flight")}</th><th>{t("score")}</th></tr></thead><tbody>{round.entries.length === 0 ? <tr><td colSpan={4} className="emptyTable">{t("noEntries")}</td></tr> : round.entries.map((entry) => <tr key={entry.id}><td>{(entry.flight.startTime || entry.flight.createdAt).toLocaleDateString(locale)}</td><td>{entry.user.profile?.callsign || t("unnamedPilot")}</td><td><Link href={`/flights/${entry.flight.id}`}>{entry.flight.title}</Link></td><td>{entry.score.toFixed(1)}</td></tr>)}</tbody></table></div></section></> : null}
  </main>;
}
