import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {updateBadgeStateAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminBadgesPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "AdminBadges"});
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  const query = await searchParams;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const badges = await prisma.badgeDefinition.findMany({
    orderBy: {sortOrder: "asc"},
    include: {_count: {select: {users: true}}}
  });
  return <main className="wrap adminWrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader">
        <div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div>
        <Link className="btn btnSecondary" href="/admin">{t("back")}</Link>
      </div>
      <div className="cardBody">
        {updated ? <p className="badge">{t("updated")}</p> : null}
        <div className="moderationCardGrid">
          {badges.map((badge) => <article className="moderationCard" key={badge.id}>
            <div className="moderationCardMain">
              <strong>{badge.icon} {badge.name}</strong>
              <p className="muted">{badge.description} · {t("awarded", {count: badge._count.users})}</p>
            </div>
            <form action={updateBadgeStateAction} className="moderationCardActions">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="badgeId" value={badge.id} />
              <input type="hidden" name="enabled" value={badge.enabled ? "false" : "true"} />
              <button className={`btn ${badge.enabled ? "btnDanger" : "btnSuccess"}`} type="submit">
                {badge.enabled ? t("disable") : t("enable")}
              </button>
            </form>
          </article>)}
        </div>
      </div>
    </section>
  </main>;
}
