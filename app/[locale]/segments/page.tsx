import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function SegmentsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params; setRequestLocale(locale);
  const [t, segments] = await Promise.all([getTranslations({locale, namespace: "Segments"}), prisma.flightSegment.findMany({where: {active: true}, orderBy: {name: "asc"}, include: {results: {orderBy: {durationSeconds: "asc"}, take: 1}, _count: {select: {results: true}}}})]);
  return <main className="wrap"><section className="card"><div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div></div><div className="cardBody taskCardGrid">{segments.length === 0 ? <p className="muted">{t("empty")}</p> : segments.map((segment) => <article className="card taskCard" key={segment.id}><h2><Link href={`/segments/${segment.slug}`}>{segment.name}</Link></h2><p className="muted">{segment.description || t("noDescription")}</p><div className="taskCardStats"><span>{t("radius", {radius: segment.gateRadiusM})}</span><span>{t("results", {count: segment._count.results})}</span>{segment.results[0] ? <span>{t("best", {seconds: segment.results[0].durationSeconds})}</span> : null}</div></article>)}</div></section></main>;
}
