import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {compareTaskWithFlight} from "@/lib/task-planner";
import type {Prisma} from "@prisma/client";
import TaskComparisonMap from "@/app/components/TaskComparisonMap";
import {deleteTaskAction} from "../actions";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({params, searchParams}: {params: Promise<{locale: string; id: string}>; searchParams: Promise<{flight?: string}>}) {
  const [{locale, id}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const [t, session, task] = await Promise.all([
    getTranslations({locale, namespace: "Tasks"}),
    auth().catch(() => null),
    prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}, owner: {select: {name: true, profile: {select: {callsign: true}}}}}})
  ]);
  if (!task) notFound();
  const isOwner = task.ownerId === session?.user?.id;
  if (task.visibility === "PRIVATE" && !isOwner) notFound();

  const flightWhere: Prisma.FlightWhereInput = session?.user?.id
    ? {deletedAt: null, OR: [{userId: session.user.id}, {visibility: {in: ["PUBLIC", "UNLISTED"]}, moderationStatus: "APPROVED"}]}
    : {deletedAt: null, visibility: {in: ["PUBLIC", "UNLISTED"]}, moderationStatus: "APPROVED"};
  const flights = await prisma.flight.findMany({where: flightWhere, orderBy: {createdAt: "desc"}, take: 100, select: {id: true, title: true, pilotCallsign: true, distanceKm: true}});
  const selectedSummary = query.flight ? flights.find((flight) => flight.id === query.flight) : null;
  const selectedFlight = selectedSummary ? await prisma.flight.findUnique({where: {id: selectedSummary.id}, select: {id: true, title: true, distanceKm: true, track: {orderBy: {seq: "asc"}, select: {seq: true, lat: true, lon: true}}}}) : null;
  const comparison = selectedFlight ? compareTaskWithFlight(task.waypoints, selectedFlight.track) : null;

  return <main className="wrap">
    <section className="card taskDetailHead">
      <div className="cardHead"><div><Link href="/tasks">← {t("back")}</Link><h1>{task.name}</h1><p className="muted">{task.description || t("noDescription")}</p></div><div className="taskOwnerActions">{isOwner || task.visibility === "PUBLIC" ? <a className="btn btnSecondary" href={`/${locale}/tasks/${task.id}/cup`}>{t("downloadCup")}</a> : null}{isOwner ? <><Link className="btn btnSecondary" href={`/tasks/${task.id}/edit`}>{t("edit")}</Link><form action={deleteTaskAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="taskId" value={task.id} /><button className="btn btnDanger" type="submit">{t("delete")}</button></form></> : null}</div></div>
      <div className="cardBody taskSummary"><span><strong>{task.totalDistanceKm.toFixed(1)} km</strong><small>{t("plannedDistance")}</small></span><span><strong>{task.waypoints.length}</strong><small>{t("waypoints")}</small></span><span><strong>{t(`visibility_${task.visibility}`)}</strong><small>{task.owner.profile?.callsign || task.owner.name || t("unknownOwner")}</small></span></div>
    </section>
    <section className="card" style={{marginTop: 20}}>
      <div className="cardHead"><div><span className="cardTitle">{t("compareTitle")}</span><p className="muted">{t("compareHint")}</p></div><form className="taskFlightSelector"><select name="flight" defaultValue={selectedFlight?.id ?? ""}><option value="">{t("chooseFlight")}</option>{flights.map((flight) => <option key={flight.id} value={flight.id}>{flight.title} · {flight.pilotCallsign} · {Math.round(flight.distanceKm)} km</option>)}</select><button className="btn btnSecondary" type="submit">{t("compare")}</button></form></div>
      <TaskComparisonMap task={task.waypoints} track={selectedFlight?.track} />
      {comparison && selectedFlight ? <div className="cardBody taskComparisonResult">
        <div className="taskSummary"><span><strong>{comparison.completed ? t("completed") : t("notCompleted")}</strong><small>{t("result")}</small></span><span><strong>{comparison.coveragePercent}%</strong><small>{t("coverage", {reached: comparison.reachedCount, total: task.waypoints.length})}</small></span><span><strong>{selectedFlight.distanceKm.toFixed(1)} km</strong><small>{t("flownDistance")}</small></span></div>
        <ol className="taskComparisonWaypoints">{comparison.waypoints.map((result, index) => <li className={result.reached ? "reached" : "missed"} key={task.waypoints[index].id}><strong>{index + 1}. {task.waypoints[index].name || task.waypoints[index].code || t("unnamedWaypoint")}</strong><span>{result.reached ? t("reached") : t("missedBy", {meters: result.nearestDistanceM})}</span></li>)}</ol>
      </div> : null}
    </section>
  </main>;
}
