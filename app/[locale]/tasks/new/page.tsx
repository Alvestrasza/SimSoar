import {redirect} from "next/navigation";
import {auth} from "@/auth";
import TaskPlanner from "@/app/components/TaskPlanner";
import {saveTaskAction} from "../actions";
import {setRequestLocale} from "next-intl/server";
import {prisma} from "@/lib/db";

export default async function NewTaskPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const session = await auth().catch(() => null);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const libraryPoints = await prisma.importedWaypoint.findMany({where: {cupImport: {ownerId: session.user.id}}, orderBy: [{name: "asc"}, {seq: "asc"}], take: 5000, select: {id: true, name: true, code: true, lat: true, lon: true}});
  return <main className="wrap"><TaskPlanner action={saveTaskAction} locale={locale} libraryPoints={libraryPoints.map((point) => ({...point, radiusM: 500}))} /></main>;
}
