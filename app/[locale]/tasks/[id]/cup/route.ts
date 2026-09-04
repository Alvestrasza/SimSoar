import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {exportTaskToCup} from "@/lib/cup";
import {safeFilename} from "@/lib/security";

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const [session, task] = await Promise.all([
    auth().catch(() => null),
    prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}}})
  ]);
  if (!task || (task.ownerId !== session?.user?.id && task.visibility !== "PUBLIC")) notFound();
  const body = exportTaskToCup({name: task.name, waypoints: task.waypoints});
  const date = task.createdAt.toISOString().slice(0, 10);
  const filename = `${safeFilename(task.name).replace(/\.igc$/i, "")}-${date}.cup`;
  return new Response(body, {headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": task.visibility === "PUBLIC" ? "public, max-age=300" : "private, no-store",
    "X-Content-Type-Options": "nosniff"
  }});
}
