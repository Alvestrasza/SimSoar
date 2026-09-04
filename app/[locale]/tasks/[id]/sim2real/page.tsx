import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {buildSim2RealReview, parseSim2RealAssumptions} from "@/lib/sim2real";
import {configuredBriefingLinks, loadRelevantAirspaces} from "@/lib/sim2real-server";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type Query = {mode?: string; aircraft?: string; glideRatio?: string; cruiseSpeedKmh?: string; plannedAltitudeM?: string};

export default async function Sim2RealPage({params, searchParams}: {params: Promise<{locale: string; id: string}>; searchParams: Promise<Query>}) {
  const [{locale, id}, query, session] = await Promise.all([params, searchParams, auth().catch(() => null)]);
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Sim2Real"});
  const task = await prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}}});
  if (!task || (task.visibility === "PRIVATE" && task.ownerId !== session?.user?.id)) notFound();
  if (query.mode !== "review") return <main className="wrap"><section className="card"><div className="cardHead"><div><Link href={`/tasks/${task.id}`}>← {t("back")}</Link><h1>{t("activationTitle")}</h1></div></div><div className="cardBody"><div className="moderationNotice"><strong>{t("draftOnly")}</strong><p>{t("activationWarning")}</p></div><Link className="btn btnPrimary" href={`/tasks/${task.id}/sim2real?mode=review`}>{t("activate")}</Link></div></section></main>;
  const assumptions = parseSim2RealAssumptions(query);
  const relevant = await loadRelevantAirspaces(task.waypoints);
  const review = buildSim2RealReview({task, airspaces: relevant.airspaces, assumptions, airspaceQueryTruncated: relevant.truncated});
  const exportParams = new URLSearchParams({confirmed: "1", reviewedTaskRevision: String(task.revision), aircraft: assumptions.aircraft || "", glideRatio: assumptions.glideRatio?.toString() || "", cruiseSpeedKmh: assumptions.cruiseSpeedKmh?.toString() || "", plannedAltitudeM: assumptions.plannedAltitudeM?.toString() || ""});
  return <main className="wrap">
    <section className="card"><div className="cardHead"><div><Link href={`/tasks/${task.id}`}>← {t("back")}</Link><h1>{t("title")}: {task.name}</h1><p className="muted">{t("subtitle", {revision: task.revision})}</p></div></div><div className="cardBody"><div className="moderationNotice"><strong>{t("draftOnly")}</strong><p>{t("picWarning")}</p></div></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("assumptions")}</span></div><form className="cardBody formGrid" method="get"><input type="hidden" name="mode" value="review"/><label><span>{t("aircraft")}</span><input name="aircraft" maxLength={120} defaultValue={assumptions.aircraft || ""}/></label><label><span>{t("glideRatio")}</span><input name="glideRatio" type="number" min="5" max="100" step="0.1" defaultValue={assumptions.glideRatio || ""}/></label><label><span>{t("cruiseSpeed")}</span><input name="cruiseSpeedKmh" type="number" min="30" max="300" step="1" defaultValue={assumptions.cruiseSpeedKmh || ""}/></label><label><span>{t("plannedAltitude")}</span><input name="plannedAltitudeM" type="number" min="0" max="15000" step="10" defaultValue={assumptions.plannedAltitudeM ?? ""}/></label><button className="btn btnSecondary" type="submit">{t("recalculate")}</button></form></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("summary")}</span></div><div className="cardBody taskSummary"><span><strong>{review.summary.distanceKm.toFixed(1)} km</strong><small>{t("distance")}</small></span><span><strong>{review.summary.estimatedDurationMinutes === null ? t("unknown") : `${review.summary.estimatedDurationMinutes} min`}</strong><small>{t("duration")}</small></span><span><strong>{t("unknown")}</strong><small>{t("terrainClearance")}</small></span><span><strong>{t("required")}</strong><small>{t("alternates")}</small></span></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("datasets")}</span></div><div className="tableWrap"><table><thead><tr><th>{t("dataset")}</th><th>{t("state")}</th><th>{t("source")}</th><th>{t("timestamp")}</th><th>{t("detail")}</th></tr></thead><tbody>{review.datasets.map((dataset) => <tr key={dataset.kind}><td>{t(`kind_${dataset.kind}`)}</td><td><strong>{t(`state_${dataset.state}`)}</strong></td><td>{dataset.source}</td><td>{dataset.timestamp ? new Date(dataset.timestamp).toLocaleString(locale) : t("missing")}</td><td>{dataset.detail}</td></tr>)}</tbody></table></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("airspaceConflicts")}</span></div><div className="cardBody">{review.crossings.length ? <ul>{review.crossings.map((crossing) => <li key={crossing.airspaceId}><strong>{crossing.name}</strong> · {crossing.floorLabel}–{crossing.ceilingLabel} · {crossing.verticalConflict === true ? t("verticalConflict") : crossing.verticalConflict === false ? t("verticalClear") : t("verticalUnknown")}</li>)}</ul> : <p className="muted">{t("noHorizontalConflicts")}</p>}</div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("officialBriefing")}</span></div><div className="cardBody"><p>{t("briefingNotice")}</p><ul>{configuredBriefingLinks().map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}</ul><a className="btn btnPrimary" href={`/${locale}/tasks/${task.id}/sim2real/export?${exportParams}`}>{t("downloadDraft")}</a></div></section>
  </main>;
}
