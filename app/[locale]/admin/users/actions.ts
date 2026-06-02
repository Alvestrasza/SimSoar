"use server";

import {revalidatePath} from "next/cache";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {
  hasRole,
  normalizeSimSoarRoles,
  SIMSOAR_ROLE_ORDER,
  type SimSoarRole
} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {updateKeycloakUserSimSoarRoleGroups} from "@/lib/keycloak-admin";

function readString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRequestedRoles(formData: FormData): SimSoarRole[] {
  const rawRoles = formData
    .getAll("roles")
    .filter((value): value is string => typeof value === "string");

  return normalizeSimSoarRoles(rawRoles);
}

export async function updateUserRoles(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (!hasRole(session.user.roles, "ADMIN")) {
    throw new Error("Forbidden");
  }

  const targetUserId = readString(formData.get("userId"));

  if (!targetUserId) {
    throw new Error("Missing target user.");
  }

  const actorIsOwner = hasRole(session.user.roles, "OWNER");

  const targetUser = await prisma.user.findUnique({
    where: {
      id: targetUserId
    },
    select: {
      id: true,
      email: true,
      roles: true
    }
  });

  if (!targetUser) {
    throw new Error("Target user not found.");
  }

  const requestedRoles = new Set(readRequestedRoles(formData));

  requestedRoles.add("USER");

  /*
   * Normal admins may manage USER, PILOT and MODERATOR.
   * OWNER is required to assign or remove ADMIN / OWNER.
   * This prevents normal admins from creating other admins or changing owner accounts.
   */
  if (!actorIsOwner) {
    requestedRoles.delete("ADMIN");
    requestedRoles.delete("OWNER");

    if (targetUser.roles.includes("ADMIN")) {
      requestedRoles.add("ADMIN");
    }

    if (targetUser.roles.includes("OWNER")) {
      requestedRoles.add("OWNER");
    }
  }

  const finalRoles = normalizeSimSoarRoles([...requestedRoles]);

  /*
   * Prevent admins from removing their own admin access by accident.
   */
  if (targetUserId === session.user.id && !hasRole(finalRoles, "ADMIN")) {
    throw new Error("You cannot remove your own administrator access.");
  }

  const previousRoles = normalizeSimSoarRoles(targetUser.roles);

  const targetAccount = await prisma.account.findFirst({
    where: {
      userId: targetUserId,
      provider: "keycloak"
    },
    select: {
      providerAccountId: true
    }
  });

  if (!targetAccount?.providerAccountId) {
    throw new Error("No Keycloak account mapping found for this user.");
  }

  /*
   * Keycloak / AD is authoritative for role membership.
   * Update Keycloak first, then mirror the resulting roles into SimSoar.
   */
  await updateKeycloakUserSimSoarRoleGroups(
    targetAccount.providerAccountId,
    finalRoles
  );

  await prisma.user.update({
    where: {
      id: targetUserId
    },
    data: {
      roles: finalRoles
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "USER_ROLE_UPDATE",
    targetType: "User",
    targetId: targetUserId,
    summary: "User roles were updated by a SimSoar administrator.",
    metadata: {
      targetEmail: targetUser.email,
      previousRoles,
      newRoles: finalRoles,
      actorRoles: normalizeSimSoarRoles(session.user.roles ?? []),
      roleOrder: SIMSOAR_ROLE_ORDER,
      keycloakUserId: targetAccount.providerAccountId,
      roleSource: "keycloak_groups"      
    }
  });

  revalidatePath("/admin/users");
}
