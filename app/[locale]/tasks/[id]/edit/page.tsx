import {notFound, redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import TaskPlanner from "@/app/components/TaskPlanner";
import {saveTaskAction} from "../../actions";
import {setRequestLocale} from "next-intl/server";

export default async function EditTaskPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const session = await auth().catch(() => null);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const [task, libraryPoints] = await Promise.all([
    prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}}}),
    prisma.importedWaypoint.findMany({where: {cupImport: {ownerId: session.user.id}}, orderBy: [{name: "asc"}, {seq: "asc"}], take: 5000, select: {id: true, name: true, code: true, lat: true, lon: true}})
  ]);
  if (!task || task.ownerId !== session.user.id) notFound();
  return <main className="wrap"><TaskPlanner action={saveTaskAction} locale={locale} taskId={task.id} initialName={task.name} initialDescription={task.description ?? ""} initialVisibility={task.visibility} initialPoints={task.waypoints.map(({name, code, lat, lon, radiusM}) => ({name, code, lat, lon, radiusM}))} libraryPoints={libraryPoints.map((point) => ({...point, radiusM: 500}))} /></main>;
}
