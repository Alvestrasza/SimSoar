import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {ensureLeagueRounds} from "@/lib/leagues";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function LeaguesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params; setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Leagues"});
  await ensureLeagueRounds();
  const leagues = await prisma.league.findMany({
    where: {active: true}, orderBy: {name: "asc"},
    include: {club: {select: {name: true}}, rounds: {orderBy: {startsAt: "desc"}, take: 1, include: {_count: {select: {entries: true}}}}, _count: {select: {rounds: true}}}
  });
  return <main className="wrap"><section className="card"><div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div></div><div className="cardBody clubGrid">
    {leagues.length === 0 ? <p className="muted">{t("empty")}</p> : leagues.map((league) => {
      const latest = league.rounds[0];
      return <article className="card clubCard" key={league.id}><h2><Link href={`/leagues/${league.slug}`}>{league.name}</Link></h2><p className="muted">{league.description || t("noDescription")}</p><div className="clubStats"><span>{t(`mode_${league.mode}`)}</span><span>{league.scope === "CLUB" ? league.club?.name || t("clubUnavailable") : t("global")}</span><span>{t("rounds", {count: league._count.rounds})}</span>{latest ? <span>{t("latestEntries", {count: latest._count.entries})}</span> : null}</div></article>;
    })}
  </div></section></main>;
}
