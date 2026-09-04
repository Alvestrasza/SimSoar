import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {ensureLeagueRounds} from "@/lib/leagues";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {deleteLeagueAction, saveLeagueAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLeaguesPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {locale} = await params; setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "AdminLeagues"});
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  await ensureLeagueRounds();
  const [query, clubs, leagues] = await Promise.all([
    searchParams,
    prisma.club.findMany({orderBy: {name: "asc"}, select: {id: true, name: true}}),
    prisma.league.findMany({orderBy: {name: "asc"}, include: {club: {select: {name: true}}, rounds: {orderBy: {startsAt: "desc"}, take: 1, include: {_count: {select: {entries: true}}}}}})
  ]);
  const notice = (Array.isArray(query.updated) ? query.updated[0] : query.updated) || (Array.isArray(query.deleted) ? query.deleted[0] : query.deleted);
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const fields = (league?: typeof leagues[number]) => <>
    <input type="hidden" name="locale" value={locale} />{league ? <input type="hidden" name="leagueId" value={league.id} /> : null}
    <label><span>{t("name")}</span><input name="name" required defaultValue={league?.name} /></label>
    <label><span>{t("slug")}</span><input name="slug" defaultValue={league?.slug} /></label>
    <label><span>{t("mode")}</span><select name="mode" defaultValue={league?.mode || "WEEKEND"}><option value="WEEKEND">{t("mode_WEEKEND")}</option><option value="WEEKLY">{t("mode_WEEKLY")}</option></select></label>
    <label><span>{t("scope")}</span><select name="scope" defaultValue={league?.scope || "GLOBAL"}><option value="GLOBAL">{t("scope_GLOBAL")}</option><option value="CLUB">{t("scope_CLUB")}</option></select></label>
    <label><span>{t("club")}</span><select name="clubId" defaultValue={league?.clubId ?? ""}><option value="">{t("noClub")}</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
    <label><span>{t("startDay")}</span><select name="startDayUtc" defaultValue={league?.startDayUtc ?? 5}>{[0,1,2,3,4,5,6].map((day) => <option key={day} value={day}>{t(`day_${day}`)}</option>)}</select></label>
    <label><span>{t("startHour")}</span><input name="startHourUtc" type="number" min={0} max={23} required defaultValue={league?.startHourUtc ?? 18} /></label>
    <label><span>{t("duration")}</span><input name="durationHours" type="number" min={1} max={168} required defaultValue={league?.durationHours ?? 48} /></label>
    <label><span>{t("scoring")}</span><select name="scoringRule" defaultValue={league?.scoringRule || "OLC_POINTS"}><option value="OLC_POINTS">{t("scoring_OLC_POINTS")}</option><option value="DISTANCE">{t("scoring_DISTANCE")}</option></select></label>
    <label><span>{t("active")}</span><select name="active" defaultValue={league?.active === false ? "false" : "true"}><option value="true">{t("yes")}</option><option value="false">{t("no")}</option></select></label>
    <label className="full"><span>{t("description")}</span><textarea name="description" rows={2} defaultValue={league?.description ?? ""} /></label>
  </>;
  return <main className="wrap adminWrap">
    <section className="card"><div className="cardHead adminFlightsHeader"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div><Link className="btn btnSecondary" href="/admin">{t("back")}</Link></div><div className="cardBody">
      {notice ? <p className="badge">{t("updated")}</p> : null}{error ? <p className="errorBox">{t(`error_${error}`)}</p> : null}
      <form action={saveLeagueAction} className="formGrid">{fields()}<button className="btn btnPrimary" type="submit">{t("create")}</button></form>
    </div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("existing")}</span></div><div className="cardBody moderationCardGrid">
      {leagues.length === 0 ? <p className="muted">{t("empty")}</p> : leagues.map((league) => <article className="moderationCard clubAdminCard" key={league.id}>
        <div><strong>{league.name}</strong><p className="muted">{t(`mode_${league.mode}`)} · {t(`scope_${league.scope}`)}{league.club ? ` · ${league.club.name}` : ""} · {t("latestEntries", {count: league.rounds[0]?._count.entries ?? 0})}</p></div>
        <form action={saveLeagueAction} className="formGrid">{fields(league)}<button className="btn btnSecondary" type="submit">{t("save")}</button></form>
        <div className="clubAssignForm"><Link className="btn btnSecondary" href={`/leagues/${league.slug}`}>{t("open")}</Link><form action={deleteLeagueAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="leagueId" value={league.id} /><button className="btn btnDanger" type="submit">{t("delete")}</button></form></div>
      </article>)}
    </div></section>
  </main>;
}
