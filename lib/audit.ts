import type {AuditAction, Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";

type WriteAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog({
  actorUserId = null,
  actorEmail = null,
  action,
  targetType,
  targetId = null,
  summary,
  metadata
}: WriteAuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        actorEmail,
        action,
        targetType,
        targetId,
        summary,
        metadata: metadata ?? undefined
      }
    });
  } catch (error) {
    console.error("Failed to write audit log", {
      action,
      targetType,
      targetId,
      error
    });
  }
}
