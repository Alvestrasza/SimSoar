import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {assignClubMemberAction, deleteClubAction, removeClubMemberAction, saveClubAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminClubsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "AdminClubs"});
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  const query = await searchParams;
  const notice = (Array.isArray(query.updated) ? query.updated[0] : query.updated) ||
    (Array.isArray(query.deleted) ? query.deleted[0] : query.deleted);
  const [clubs, users] = await Promise.all([
    prisma.club.findMany({
      orderBy: {name: "asc"},
      include: {
        memberships: {
          orderBy: [{role: "desc"}, {joinedAt: "asc"}],
          include: {user: {select: {email: true, profile: {select: {callsign: true}}}}}
        }
      }
    }),
    prisma.user.findMany({
      orderBy: {email: "asc"},
      select: {id: true, email: true, profile: {select: {callsign: true}}}
    })
  ]);

  return <main className="wrap adminWrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader">
        <div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div>
        <Link className="btn btnSecondary" href="/admin">{t("back")}</Link>
      </div>
      <div className="cardBody">
        {notice ? <p className="badge">{t("updated")}</p> : null}
        <h3>{t("create")}</h3>
        <form action={saveClubAction} className="formGrid">
          <input type="hidden" name="locale" value={locale} />
          <label><span>{t("name")}</span><input name="name" required minLength={2} maxLength={120} /></label>
          <label><span>{t("slug")}</span><input name="slug" maxLength={80} placeholder={t("slugHint")} /></label>
          <label className="full"><span>{t("description")}</span><textarea name="description" maxLength={2000} rows={3} /></label>
          <button className="btn btnPrimary" type="submit">{t("createButton")}</button>
        </form>
      </div>
    </section>

    <section className="card" style={{marginTop: 20}}>
      <div className="cardHead"><span className="cardTitle">{t("existing")}</span></div>
      <div className="cardBody moderationCardGrid">
        {clubs.length === 0 ? <p className="muted">{t("empty")}</p> : clubs.map((club) => <article className="moderationCard clubAdminCard" key={club.id}>
          <form action={saveClubAction} className="formGrid clubAdminForm">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="clubId" value={club.id} />
            <label><span>{t("name")}</span><input name="name" required defaultValue={club.name} /></label>
            <label><span>{t("slug")}</span><input name="slug" required defaultValue={club.slug} /></label>
            <label className="full"><span>{t("description")}</span><textarea name="description" defaultValue={club.description ?? ""} rows={2} /></label>
            <button className="btn btnSecondary" type="submit">{t("save")}</button>
          </form>

          <div className="clubMemberAdmin">
            <strong>{t("members", {count: club.memberships.length})}</strong>
            {club.memberships.map((membership) => <div className="clubMemberRow" key={membership.id}>
              <span>{membership.user.profile?.callsign || membership.user.email} · {t(`role_${membership.role}`)}</span>
              <form action={removeClubMemberAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="membershipId" value={membership.id} />
                <button className="btn btnDanger" type="submit">{t("remove")}</button>
              </form>
            </div>)}
            <form action={assignClubMemberAction} className="clubAssignForm">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="clubId" value={club.id} />
              <select name="userId" required aria-label={t("user")}>
                <option value="">{t("chooseUser")}</option>
                {users.map((user) => <option value={user.id} key={user.id}>{user.profile?.callsign ? `${user.profile.callsign} · ` : ""}{user.email}</option>)}
              </select>
              <select name="role" aria-label={t("role")}><option value="MEMBER">{t("role_MEMBER")}</option><option value="MANAGER">{t("role_MANAGER")}</option></select>
              <button className="btn btnPrimary" type="submit">{t("assign")}</button>
            </form>
          </div>
          <form action={deleteClubAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="clubId" value={club.id} />
            <button className="btn btnDanger" type="submit">{t("delete")}</button>
          </form>
        </article>)}
      </div>
    </section>
  </main>;
}
