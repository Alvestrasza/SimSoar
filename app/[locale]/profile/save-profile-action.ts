"use server";

import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {updateKeycloakUserCallsign} from "@/lib/keycloak-admin";
import {writeAuditLog} from "@/lib/audit";

const schema = z.object({
  callsign: z
    .string()
    .trim()
    .min(3, "Callsign must contain at least 3 characters.")
    .max(32, "Callsign must contain at most 32 characters.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Callsign may only contain letters, numbers, underscore and hyphen."
    ),
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

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

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

  const {locale, ...profileData} = data;

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "keycloak"
    },
    select: {
      providerAccountId: true
    }
  });

  const keycloakUserId = account?.providerAccountId ?? null;

  const callsignTaken = await prisma.pilotProfile.findFirst({
    where: {
      callsign: profileData.callsign,
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

  const previousProfile = await prisma.pilotProfile.findUnique({
  where: {
    userId: session.user.id
  },
  select: {
    callsign: true,
    homeAirfield: true,
    favoriteSim: true,
    favoriteGlider: true,
    country: true,
    bio: true,
    showHomeAirfieldOnHome: true
  }
});

  const updatedProfile = await prisma.pilotProfile.upsert({
    where: {
      userId: session.user.id
    },
    create: {
      userId: session.user.id,
      ...profileData
    },
    update: profileData,
    select: {
      id: true,
      callsign: true,
      homeAirfield: true,
      favoriteSim: true,
      favoriteGlider: true,
      country: true,
      bio: true,
      showHomeAirfieldOnHome: true
    }
  });

  let keycloakCallsignSyncStatus:
    | "not_configured"
    | "synced"
    | "failed" = "not_configured";

  if (keycloakUserId) {
    try {
      const keycloakUserId = account.providerAccountId;

      try {
        console.info("SimSoar profile save callsign sync:", {
          simsoarUserId: session.user.id,
          keycloakUserId,
          callsign: profileData.callsign
        });

        await updateKeycloakUserCallsign(
          keycloakUserId,
          profileData.callsign
        );

        console.info("SimSoar profile save callsign sync completed:", {
          simsoarUserId: session.user.id,
          keycloakUserId,
          callsign: profileData.callsign
        });
      } catch (error) {
        console.error("SimSoar profile save aborted because Keycloak callsign sync failed:", {
          simsoarUserId: session.user.id,
          keycloakUserId,
          callsign: profileData.callsign,
          error
        });

        throw new Error(
          "The callsign could not be written to Keycloak. The SimSoar profile was not changed."
        );
      }
    } catch (error) {
      keycloakCallsignSyncStatus = "failed";

      console.warn("SimSoar profile was saved locally, but Keycloak callsign sync failed:", {
        simsoarUserId: session.user.id,
        keycloakUserId,
        callsign: updatedProfile.callsign,
        error
      });
    }
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "PILOT_PROFILE_UPDATE",
    targetType: "PilotProfile",
    targetId: updatedProfile.id,
    summary: "Pilot profile was updated by the owner.",
    metadata: {
      previous: previousProfile,
      current: {
        callsign: updatedProfile.callsign,
        homeAirfield: updatedProfile.homeAirfield,
        favoriteSim: updatedProfile.favoriteSim,
        favoriteGlider: updatedProfile.favoriteGlider,
        country: updatedProfile.country,
        bio: updatedProfile.bio,
        showHomeAirfieldOnHome: updatedProfile.showHomeAirfieldOnHome
      },
      keycloakUserId,
      keycloakCallsignSyncStatus: "synced"
    }
  });

  redirect(`/${locale}/profile?saved=1`);
}
