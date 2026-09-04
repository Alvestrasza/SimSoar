import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {archivePastCompetitions} from "@/lib/competitions";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {closeCompetitionAction, deleteCompetitionAction, saveCompetitionAction} from "./actions";
import {EVIDENCE_FIELDS} from "@/lib/authenticity";

export const dynamic = "force-dynamic";
function localDateTime(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export default async function AdminCompetitionsPage({params, searchParams}: {
  params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "AdminCompetitions"});
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  await archivePastCompetitions();
  const [query, competitions] = await Promise.all([
    searchParams,
    prisma.competition.findMany({orderBy: {startAt: "desc"}, include: {_count: {select: {entries: true}}}})
  ]);
  const updated = (Array.isArray(query.updated) ? query.updated[0] : query.updated) || (Array.isArray(query.deleted) ? query.deleted[0] : query.deleted);
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const formFields = (competition?: typeof competitions[number]) => <>
    <input type="hidden" name="locale" value={locale} />
    {competition ? <input type="hidden" name="competitionId" value={competition.id} /> : null}
    <label><span>{t("name")}</span><input name="name" required defaultValue={competition?.name} /></label>
    <label><span>{t("slug")}</span><input name="slug" defaultValue={competition?.slug} /></label>
    <label><span>{t("start")}</span><input type="datetime-local" name="startAt" required defaultValue={competition ? localDateTime(competition.startAt) : ""} /></label>
    <label><span>{t("end")}</span><input type="datetime-local" name="endAt" required defaultValue={competition ? localDateTime(competition.endAt) : ""} /></label>
    <label><span>{t("status")}</span><select name="status" defaultValue={competition?.status === "ACTIVE" ? "ACTIVE" : "DRAFT"}><option value="DRAFT">{t("status_DRAFT")}</option><option value="ACTIVE">{t("status_ACTIVE")}</option></select></label>
    <label><span>{t("scoring")}</span><select name="scoringRule" defaultValue={competition?.scoringRule || "OLC_POINTS"}><option value="OLC_POINTS">{t("scoring_OLC_POINTS")}</option><option value="DISTANCE">{t("scoring_DISTANCE")}</option></select></label>
    <label><span>{t("simulator")}</span><input name="simulator" defaultValue={competition?.simulator ?? ""} placeholder={t("optional")} /></label>
    <label><span>{t("class")}</span><input name="competitionClass" defaultValue={competition?.competitionClass ?? ""} placeholder={t("optional")} /></label>
    <label className="full"><span>{t("description")}</span><textarea name="description" rows={2} defaultValue={competition?.description ?? ""} /></label>
    <label className="full"><span>{t("rules")}</span><textarea name="rules" rows={3} defaultValue={competition?.rules ?? ""} /></label>
    <label><input type="checkbox" name="evidenceRequired" value="true" defaultChecked={competition?.evidenceRequired ?? false} /> {t("evidenceRequired")}</label>
    <label><input type="checkbox" name="requireSignedEvidence" value="true" defaultChecked={competition?.requireSignedEvidence ?? false} /> {t("requireSignedEvidence")}</label>
    <label className="full"><span>{t("evidenceSimulators")}</span><input name="evidenceSimulators" defaultValue={competition?.evidenceSimulators.join(", ") ?? ""} placeholder={t("evidenceSimulatorsHint")} /></label>
    <label className="full"><span>{t("requiredTaskPackageId")}</span><input name="requiredTaskPackageId" defaultValue={competition?.requiredTaskPackageId ?? ""} placeholder={t("optional")} /></label>
    <fieldset className="full"><legend>{t("requiredEvidenceFields")}</legend><div className="formGrid">{EVIDENCE_FIELDS.map((field) => <label key={field}><input type="checkbox" name="requiredEvidenceFields" value={field} defaultChecked={competition?.requiredEvidenceFields.includes(field)} /> {field}</label>)}</div></fieldset>
  </>;

  return <main className="wrap adminWrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div><Link className="btn btnSecondary" href="/admin">{t("back")}</Link></div>
      <div className="cardBody">
        {updated ? <p className="badge">{t("updated")}</p> : null}
        {error ? <p className="errorBox">{t(`error_${error}`)}</p> : null}
        <form action={saveCompetitionAction} className="formGrid">{formFields()}<button className="btn btnPrimary" type="submit">{t("create")}</button></form>
      </div>
    </section>
    <section className="card" style={{marginTop: 20}}>
      <div className="cardHead"><span className="cardTitle">{t("existing")}</span></div>
      <div className="cardBody moderationCardGrid">{competitions.length === 0 ? <p className="muted">{t("empty")}</p> : competitions.map((competition) => <article className="moderationCard clubAdminCard" key={competition.id}>
        <div><strong>{competition.name}</strong><p className="muted">{t(`status_${competition.status}`)} · {t("entries", {count: competition._count.entries})}</p></div>
        {competition.status === "CLOSED" ? <p className="muted">{competition.description || t("noDescription")}</p> : <form action={saveCompetitionAction} className="formGrid">{formFields(competition)}<button className="btn btnSecondary" type="submit">{t("save")}</button></form>}
        <div className="clubAssignForm">
          <Link className="btn btnSecondary" href={`/competitions/${competition.slug}`}>{t("open")}</Link>
          {competition.status !== "CLOSED" ? <form action={closeCompetitionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="competitionId" value={competition.id} /><button className="btn btnSecondary" type="submit">{t("close")}</button></form> : null}
          <form action={deleteCompetitionAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="competitionId" value={competition.id} /><button className="btn btnDanger" type="submit">{t("delete")}</button></form>
        </div>
      </article>)}</div>
    </section>
  </main>;
}
