"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateKeycloakUserCallsign } from "@/lib/keycloak-admin";

const schema = z.object({
  callsign: z
    .string()
    .trim()
    .min(3, "Callsign must contain at least 3 characters.")
    .max(32, "Callsign must contain at most 32 characters.")
    .regex(/^[A-Za-z0-9_-]+$/, "Callsign may only contain letters, numbers, underscore and hyphen."),
  homeAirfield: z.string().max(120).optional(),
  favoriteSim: z.string().max(40).optional(),
  favoriteGlider: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  bio: z.string().max(2000).optional(),
  showHomeAirfieldOnHome: z.boolean().default(false),
  locale: z.enum(["de", "en"]).default("de")
});

export async function saveProfileAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");

  const data = schema.parse({
    callsign: formData.get("callsign"),
    homeAirfield: formData.get("homeAirfield") || undefined,
    favoriteSim: formData.get("favoriteSim") || undefined,
    favoriteGlider: formData.get("favoriteGlider") || undefined,
    country: formData.get("country") || undefined,
    bio: formData.get("bio") || undefined,
    showHomeAirfieldOnHome: formData.get("showHomeAirfieldOnHome") === "on",
    locale: formData.get("locale") || "de"
  });

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "keycloak"
    },
    select: {
      providerAccountId: true
    }
  });

  if (!account?.providerAccountId) {
    throw new Error("No Keycloak account mapping found for this SimSoar user.");
  }

  const callsignTaken = await prisma.pilotProfile.findFirst({
    where: {
      callsign: data.callsign,
      NOT: {
        userId: session.user.id
      }
    },
    select: {
      id: true
    }
  });

  if (callsignTaken) {
    throw new Error("This callsign is already used by another SimSoar pilot.");
  }

  console.info("SimSoar profile save callsign sync:", {
    simsoarUserId: session.user.id,
    keycloakUserId: account.providerAccountId,
    callsign: data.callsign
  });

  await updateKeycloakUserCallsign(account.providerAccountId, data.callsign);

  console.info("SimSoar profile save callsign sync completed:", {
    simsoarUserId: session.user.id,
    keycloakUserId: account.providerAccountId,
    callsign: data.callsign
  });

  await prisma.pilotProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data
  });

  redirect(`/${data.locale}/profile?saved=1`);
}