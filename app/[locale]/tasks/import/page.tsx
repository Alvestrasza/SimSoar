import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {importCupAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportCupPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{error?: string; line?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const [session, t] = await Promise.all([auth().catch(() => null), getTranslations({locale, namespace: "CupImport"})]);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const imports = await prisma.cupImport.findMany({where: {ownerId: session.user.id}, orderBy: {createdAt: "desc"}, take: 20, include: {_count: {select: {waypoints: true}}}});
  const errorKey = query.error && ["invalid-size", "invalid-extension", "duplicate", "empty", "invalid-header", "invalid-csv", "unclosed-quote", "missing-name", "duplicate-waypoint", "invalid-lat", "invalid-lon", "no-waypoints", "too-many-waypoints", "invalid-task-csv", "invalid-task", "unknown-task-waypoint", "too-many-tasks"].includes(query.error) ? query.error : null;
  return <main className="wrap">
    <section className="card">
      <div className="cardHead"><div><Link href="/tasks">← {t("back")}</Link><h1>{t("title")}</h1><p className="muted">{t("subtitle")}</p></div></div>
      <div className="cardBody">
        {errorKey ? <div className="errorBox"><strong>{t("errorTitle")}</strong><p>{t(`error_${errorKey}`)}{query.line ? ` (${t("line", {line: query.line})})` : ""}</p></div> : null}
        <form action={importCupAction} className="cupImportForm"><input type="hidden" name="locale" value={locale} /><label><span>{t("file")}</span><input name="file" type="file" accept=".cup,text/csv,text/plain" required /></label><p className="muted">{t("formatHint")}</p><button className="btn btnPrimary" type="submit">{t("import")}</button></form>
      </div>
    </section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("history")}</span></div><div className="cardBody cupImportHistory">{imports.length === 0 ? <p className="muted">{t("emptyHistory")}</p> : imports.map((item) => <div key={item.id}><strong>{item.sourceName}</strong><span>{t("waypoints", {count: item._count.waypoints})}</span><time>{item.createdAt.toLocaleString(locale)}</time></div>)}</div></section>
  </main>;
}
