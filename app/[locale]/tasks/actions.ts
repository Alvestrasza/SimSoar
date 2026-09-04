"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {normalizeTaskPoints, taskDistanceKm, type TaskPoint} from "@/lib/task-planner";

const taskSchema = z.object({
  taskId: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
  waypoints: z.string().min(2).max(100_000)
});

function safeLocale(value: FormDataEntryValue | null) {
  return value === "en" ? "en" : "de";
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authorized.");
  return session;
}

function parseWaypoints(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("The waypoint data is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("The waypoint data is invalid.");
  return normalizeTaskPoints(parsed as TaskPoint[]);
}

export async function saveTaskAction(formData: FormData) {
  const session = await requireUser();
  const locale = safeLocale(formData.get("locale"));
  const values = taskSchema.parse({
    taskId: String(formData.get("taskId") ?? "") || undefined,
    name: formData.get("name"),
    description: String(formData.get("description") ?? "") || undefined,
    visibility: formData.get("visibility"),
    waypoints: formData.get("waypoints")
  });
  const waypoints = parseWaypoints(values.waypoints);
  const data = {
    name: values.name,
    description: values.description || null,
    visibility: values.visibility,
    totalDistanceKm: taskDistanceKm(waypoints)
  };

  let task;
  if (values.taskId) {
    const existing = await prisma.flightTask.findUnique({where: {id: values.taskId}, select: {ownerId: true}});
    if (!existing || existing.ownerId !== session.user.id) throw new Error("Not authorized.");
    task = await prisma.$transaction(async (tx) => {
      await tx.taskWaypoint.deleteMany({where: {taskId: values.taskId}});
      return tx.flightTask.update({
        where: {id: values.taskId},
        data: {...data, revision: {increment: 1}, waypoints: {createMany: {data: waypoints}}}
      });
    });
  } else {
    task = await prisma.flightTask.create({
      data: {...data, ownerId: session.user.id, waypoints: {createMany: {data: waypoints}}}
    });
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: values.taskId ? "TASK_UPDATE" : "TASK_CREATE",
    targetType: "FlightTask",
    targetId: task.id,
    summary: values.taskId ? "A task was updated." : "A task was created.",
    metadata: {name: task.name, visibility: task.visibility, waypointCount: waypoints.length}
  });
  revalidatePath(`/${locale}/tasks`);
  redirect(`/${locale}/tasks/${task.id}`);
}

export async function deleteTaskAction(formData: FormData) {
  const session = await requireUser();
  const locale = safeLocale(formData.get("locale"));
  const taskId = String(formData.get("taskId") ?? "");
  const existing = await prisma.flightTask.findUnique({where: {id: taskId}, select: {ownerId: true, name: true}});
  if (!existing || existing.ownerId !== session.user.id) throw new Error("Not authorized.");
  await prisma.flightTask.delete({where: {id: taskId}});
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "TASK_DELETE",
    targetType: "FlightTask",
    targetId: taskId,
    summary: "A task was deleted.",
    metadata: {name: existing.name}
  });
  revalidatePath(`/${locale}/tasks`);
  redirect(`/${locale}/tasks`);
}
