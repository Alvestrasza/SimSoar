import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {archivePastCompetitions} from "@/lib/competitions";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Competitions"});
  await archivePastCompetitions();
  const competitions = await prisma.competition.findMany({
    where: {status: {in: ["ACTIVE", "CLOSED"]}},
    orderBy: [{status: "asc"}, {startAt: "desc"}],
    include: {_count: {select: {entries: true}}}
  });
  const active = competitions.filter((competition) => competition.status === "ACTIVE");
  const archived = competitions.filter((competition) => competition.status === "CLOSED");
  const cards = (items: typeof competitions) => items.length === 0 ? <p className="muted">{t("empty")}</p> : <div className="clubGrid">{items.map((competition) => <article className="card clubCard" key={competition.id}>
    <h2><Link href={`/competitions/${competition.slug}`}>{competition.name}</Link></h2>
    <p className="muted">{competition.description || t("noDescription")}</p>
    <div className="clubStats"><span>{competition.startAt.toLocaleDateString(locale)} – {competition.endAt.toLocaleDateString(locale)}</span><span>{t("entries", {count: competition._count.entries})}</span><span>{t(`scoring_${competition.scoringRule}`)}</span></div>
    {(competition.simulator || competition.competitionClass) ? <p className="muted">{[competition.simulator, competition.competitionClass].filter(Boolean).join(" · ")}</p> : null}
  </article>)}</div>;
  return <main className="wrap">
    <section className="card"><div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div></div><div className="cardBody"><h2>{t("active")}</h2>{cards(active)}</div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("archive")}</span></div><div className="cardBody">{cards(archived)}</div></section>
  </main>;
}
