import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {deleteAirspaceAction, importAirspaceAction} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminAirspacesPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "AdminAirspaces"});
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();

  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const imported = Array.isArray(query.imported) ? query.imported[0] : query.imported;
  const requestedPage = Number(Array.isArray(query.page) ? query.page[0] : query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 100;
  const [airspaces, totalAirspaces] = await Promise.all([
    prisma.airspace.findMany({
      orderBy: {createdAt: "desc"},
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {_count: {select: {points: true}}}
    }),
    prisma.airspace.count()
  ]);
  const totalPages = Math.max(1, Math.ceil(totalAirspaces / pageSize));

  return <main className="wrap adminWrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader">
        <div><span className="cardTitle">{t("pageTitle")}</span><p className="muted">{t("subtitle")}</p></div>
        <Link className="btn btnSecondary" href="/admin">{t("backToAdmin")}</Link>
      </div>
      <div className="cardBody">
        {imported ? <p className="badge">{t("imported", {count: imported})}</p> : null}
        {error ? <p className="errorBox">{t(`error_${error}`)}</p> : null}
        <form action={importAirspaceAction} className="formGrid" encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          <label className="full"><span>{t("file")}</span><input required type="file" name="airspaceFile" accept=".txt,.air,.openair,text/plain" /></label>
          <p className="muted full">{t("formatHint")}</p>
          <button className="btn btnPrimary" type="submit">{t("import")}</button>
        </form>
      </div>
      <div className="cardBody">
        <h3>{t("available")}</h3>
        {airspaces.length === 0 ? <p className="muted">{t("empty")}</p> : <div className="moderationCardGrid">
          {airspaces.map((airspace) => <article className="moderationCard" key={airspace.id}>
            <div className="moderationCardMain"><strong>{airspace.name}</strong><p className="muted">{airspace.className} · {airspace.floorLabel} – {airspace.ceilingLabel} · {airspace._count.points} {t("points")} · {airspace.sourceName}</p></div>
            <form action={deleteAirspaceAction} className="moderationCardActions">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="airspaceId" value={airspace.id} />
              <button className="btn btnDanger" type="submit">{t("delete")}</button>
            </form>
          </article>)}
        </div>}
        {totalPages > 1 ? <nav className="pagination" aria-label={t("paginationLabel")}>
          {page > 1 ? <Link className="btn btnSecondary" href={`/admin/airspaces?page=${page - 1}`}>{t("previous")}</Link> : null}
          <span className="muted">{t("page", {page, totalPages, totalAirspaces})}</span>
          {page < totalPages ? <Link className="btn btnSecondary" href={`/admin/airspaces?page=${page + 1}`}>{t("next")}</Link> : null}
        </nav> : null}
      </div>
    </section>
  </main>;
}
