import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {buildPlanningDraftBundle, buildSim2RealReview, parseSim2RealAssumptions} from "@/lib/sim2real";
import {loadRelevantAirspaces} from "@/lib/sim2real-server";
import {safeFilename} from "@/lib/security";

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const url = new URL(request.url);
  const session = await auth().catch(() => null);
  const task = await prisma.flightTask.findUnique({where: {id}, include: {waypoints: {orderBy: {seq: "asc"}}}});
  if (!task || (task.visibility === "PRIVATE" && task.ownerId !== session?.user?.id)) notFound();
  if (url.searchParams.get("confirmed") !== "1" || url.searchParams.get("reviewedTaskRevision") !== String(task.revision)) return new Response("A current explicit Sim2Real review is required.", {status: 409, headers: {"Cache-Control": "no-store"}});
  const assumptions = parseSim2RealAssumptions(Object.fromEntries(url.searchParams));
  const relevant = await loadRelevantAirspaces(task.waypoints);
  const review = buildSim2RealReview({task, airspaces: relevant.airspaces, assumptions, airspaceQueryTruncated: relevant.truncated});
  const bundle = buildPlanningDraftBundle(task, review);
  const filename = `${safeFilename(task.name).replace(/\.igc$/i, "")}-flight-planning-draft-r${task.revision}.json`;
  return new Response(JSON.stringify(bundle, null, 2), {headers: {"Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-SimSoar-Planning-Draft": "true"}});
}
