import {notFound, redirect} from "next/navigation";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {deleteSegmentAction, saveSegmentAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSegmentsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]); setRequestLocale(locale);
  const [session, t] = await Promise.all([auth(), getTranslations({locale, namespace: "AdminSegments"})]);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  const segments = await prisma.flightSegment.findMany({orderBy: {name: "asc"}, include: {_count: {select: {results: true}}}});
  const fields = (segment?: typeof segments[number]) => <>
    <input type="hidden" name="locale" value={locale} />{segment ? <input type="hidden" name="segmentId" value={segment.id} /> : null}
    <label><span>{t("name")}</span><input name="name" required defaultValue={segment?.name} /></label><label><span>{t("slug")}</span><input name="slug" defaultValue={segment?.slug} /></label>
    <label><span>{t("startLat")}</span><input name="startLat" type="number" step="any" min={-90} max={90} required defaultValue={segment?.startLat} /></label><label><span>{t("startLon")}</span><input name="startLon" type="number" step="any" min={-180} max={180} required defaultValue={segment?.startLon} /></label>
    <label><span>{t("finishLat")}</span><input name="finishLat" type="number" step="any" min={-90} max={90} required defaultValue={segment?.finishLat} /></label><label><span>{t("finishLon")}</span><input name="finishLon" type="number" step="any" min={-180} max={180} required defaultValue={segment?.finishLon} /></label>
    <label><span>{t("radius")}</span><input name="gateRadiusM" type="number" min={50} max={20000} step={50} required defaultValue={segment?.gateRadiusM ?? 500} /></label><label><span>{t("active")}</span><select name="active" defaultValue={segment?.active === false ? "false" : "true"}><option value="true">{t("yes")}</option><option value="false">{t("no")}</option></select></label>
    <label className="full"><span>{t("description")}</span><textarea name="description" defaultValue={segment?.description ?? ""} /></label>
  </>;
  return <main className="wrap adminWrap"><section className="card"><div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div><Link className="btn btnSecondary" href="/admin">{t("back")}</Link></div><div className="cardBody">{query.updated || query.deleted ? <p className="badge">{t("updated")}</p> : null}{query.error ? <p className="errorBox">{t("error_slug")}</p> : null}<form action={saveSegmentAction} className="formGrid">{fields()}<button className="btn btnPrimary" type="submit">{t("create")}</button></form></div></section>
  <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("existing")}</span></div><div className="cardBody moderationCardGrid">{segments.length === 0 ? <p className="muted">{t("empty")}</p> : segments.map((segment) => <article className="moderationCard clubAdminCard" key={segment.id}><div><strong>{segment.name}</strong><p className="muted">{t("results", {count: segment._count.results})}</p></div><form action={saveSegmentAction} className="formGrid">{fields(segment)}<button className="btn btnSecondary" type="submit">{t("save")}</button></form><div className="taskOwnerActions"><Link className="btn btnSecondary" href={`/segments/${segment.slug}`}>{t("open")}</Link><form action={deleteSegmentAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="segmentId" value={segment.id} /><button className="btn btnDanger" type="submit">{t("delete")}</button></form></div></article>)}</div></section></main>;
}
