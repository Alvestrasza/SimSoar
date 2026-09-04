import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TasksPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations({locale, namespace: "Tasks"}), auth().catch(() => null)]);
  const tasks = await prisma.flightTask.findMany({
    where: session?.user?.id ? {OR: [{visibility: "PUBLIC"}, {ownerId: session.user.id}]} : {visibility: "PUBLIC"},
    orderBy: {updatedAt: "desc"},
    take: 100,
    include: {owner: {select: {name: true, profile: {select: {callsign: true}}}}, _count: {select: {waypoints: true}}}
  });
  return <main className="wrap">
    <section className="card">
      <div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div>{session?.user?.id ? <Link className="btn btnPrimary" href="/tasks/new">{t("create")}</Link> : null}</div>
      <div className="cardBody taskCardGrid">
        {tasks.length === 0 ? <p className="muted">{t("empty")}</p> : tasks.map((task) => <article className="card taskCard" key={task.id}>
          <h2><Link href={`/tasks/${task.id}`}>{task.name}</Link></h2>
          <p className="muted">{task.description || t("noDescription")}</p>
          <div className="taskCardStats"><span>{Math.round(task.totalDistanceKm)} km</span><span>{t("waypointCount", {count: task._count.waypoints})}</span><span>{t(`visibility_${task.visibility}`)}</span></div>
          <small className="muted">{task.owner.profile?.callsign || task.owner.name || t("unknownOwner")}</small>
        </article>)}
      </div>
    </section>
  </main>;
}
