"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

const unblockSchema = z.object({
  blockId: z.string().min(1),
  returnTo: z.string().min(1).optional()
});

function safeReturnTo(value: string | undefined) {
  const returnTo = value || "/de/admin/igc-blocks";

  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/de/admin/igc-blocks";
  }

  return returnTo;
}

export async function unblockIgcUploadHashAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  if (!hasRole(session.user.roles, "ADMIN")) {
    throw new Error("Not authorized.");
  }

  const fields = unblockSchema.parse({
    blockId: formData.get("blockId"),
    returnTo: formData.get("returnTo") || undefined
  });

  const returnTo = safeReturnTo(fields.returnTo);

  const block = await prisma.igcUploadBlock.findUnique({
    where: {
      id: fields.blockId
    },
    select: {
      id: true,
      igcSha256: true,
      originalFlightId: true,
      originalTitle: true,
      originalPilotCallsign: true,
      reason: true,
      blockedAt: true,
      blockedByUserId: true
    }
  });

  if (!block) {
    throw new Error("Blocked IGC hash not found.");
  }

  await prisma.igcUploadBlock.delete({
    where: {
      id: block.id
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "IGC_UPLOAD_UNBLOCK",
    targetType: "IgcUploadBlock",
    targetId: block.id,
    summary: "Blocked IGC upload hash was manually released by an administrator.",
    metadata: {
      igcSha256: block.igcSha256,
      originalFlightId: block.originalFlightId,
      originalTitle: block.originalTitle,
      originalPilotCallsign: block.originalPilotCallsign,
      reason: block.reason,
      blockedAt: block.blockedAt.toISOString(),
      blockedByUserId: block.blockedByUserId
    }
  });

  revalidatePath("/de/admin");
  revalidatePath("/en/admin");
  revalidatePath("/de/admin/igc-blocks");
  revalidatePath("/en/admin/igc-blocks");

  redirect(`${returnTo}?updated=1`);
}
