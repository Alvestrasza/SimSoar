import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {safeFilename} from "@/lib/security";
import {createTaskPackage, validateAndMaterializeTaskPackage} from "@/lib/task-package";

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const [session, task] = await Promise.all([
    auth().catch(() => null),
    prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}}})
  ]);
  if (!task || (task.ownerId !== session?.user?.id && task.visibility === "PRIVATE")) notFound();

  const taskPackage = createTaskPackage(task);
  validateAndMaterializeTaskPackage(taskPackage);
  await prisma.flightTask.update({where: {id: task.id}, data: {packageDownloads: {increment: 1}}});
  const filename = `${safeFilename(task.name).replace(/\.igc$/i, "")}-r${task.revision}.simsoar-task.json`;
  return Response.json(taskPackage, {headers: {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff"
  }});
}
