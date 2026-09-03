"use server";

import {auth} from "@/auth";
import {writeAuditLog} from "@/lib/audit";
import {prisma} from "@/lib/db";
import {canFollowPilot, parseFollowIntent} from "@/lib/pilot-follow";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

function safeReturnPath(value: FormDataEntryValue | null, locale: "de" | "en") {
  if (typeof value !== "string") return `/${locale}/pilots`;
  if (!value.startsWith(`/${locale}/pilots`) || value.includes("//")) {
    return `/${locale}/pilots`;
  }
  return value;
}

export async function updatePilotFollowAction(formData: FormData) {
  const session = await auth();
  const locale = formData.get("locale") === "en" ? "en" : "de";

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const pilotUserId = String(formData.get("pilotUserId") ?? "").trim();
  const intent = parseFollowIntent(formData.get("intent"));
  const returnTo = safeReturnPath(formData.get("returnTo"), locale);

  if (!canFollowPilot(session.user.id, pilotUserId)) {
    throw new Error("This pilot cannot be followed.");
  }

  const pilot = await prisma.user.findFirst({
    where: {
      id: pilotUserId,
      profile: {isNot: null}
    },
    select: {
      id: true,
      profile: {select: {callsign: true}}
    }
  });

  if (!pilot?.profile) {
    throw new Error("Pilot not found.");
  }

  if (intent === "follow") {
    await prisma.pilotFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: pilot.id
        }
      },
      create: {
        followerId: session.user.id,
        followingId: pilot.id
      },
      update: {}
    });
  } else {
    await prisma.pilotFollow.deleteMany({
      where: {
        followerId: session.user.id,
        followingId: pilot.id
      }
    });
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: intent === "follow" ? "PILOT_FOLLOW" : "PILOT_UNFOLLOW",
    targetType: "User",
    targetId: pilot.id,
    summary:
      intent === "follow"
        ? "Pilot was followed by a user."
        : "Pilot follow relationship was removed by a user.",
    metadata: {callsign: pilot.profile.callsign}
  });

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/pilots`);
  revalidatePath(`/${locale}/pilots/${pilot.id}`);
  redirect(returnTo);
}
