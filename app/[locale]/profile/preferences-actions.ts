"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";

const preferencesSchema = z.object({
  locale: z.enum(["de", "en"]).default("de"),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
  preferredSimulator: z.enum([
    "MSFS 2024",
    "MSFS 2020",
    "Condor 2",
    "X-Plane 12",
    "X-Plane 11",
    "DCS World",
    "Other"
  ]),
  unitSystem: z.enum(["METRIC", "IMPERIAL"]),
  preferredLeaderboardView: z.enum(["ALL", "MSFS", "CONDOR", "XPLANE"]),
  preferredMapMode: z.enum(["STANDARD", "SATELLITE", "TERRAIN"]),
  homeFeedMode: z.enum(["PUBLIC", "OWN", "FOLLOWING"]),
  homeFeedSimulator: z.string().trim().max(80).transform((value) => value || null),
  homeFeedCompetitionClass: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || null)
});

export async function savePreferencesAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  const fields = preferencesSchema.parse({
    locale: formData.get("locale") || "de",
    theme: formData.get("theme"),
    preferredSimulator: formData.get("preferredSimulator") || "MSFS 2024",
    unitSystem: formData.get("unitSystem") || "METRIC",
    preferredLeaderboardView: formData.get("preferredLeaderboardView") || "ALL",
    preferredMapMode: formData.get("preferredMapMode") || "STANDARD",
    homeFeedMode: formData.get("homeFeedMode") || "PUBLIC",
    homeFeedSimulator: formData.get("homeFeedSimulator") || "",
    homeFeedCompetitionClass: formData.get("homeFeedCompetitionClass") || ""
  });

  await prisma.userPreference.upsert({
    where: {
      userId: session.user.id
    },
    create: {
      userId: session.user.id,
      theme: fields.theme,
      preferredSimulator: fields.preferredSimulator,
      unitSystem: fields.unitSystem,
      preferredLeaderboardView: fields.preferredLeaderboardView,
      preferredMapMode: fields.preferredMapMode,
      homeFeedMode: fields.homeFeedMode,
      homeFeedSimulator: fields.homeFeedSimulator,
      homeFeedCompetitionClass: fields.homeFeedCompetitionClass
    },
    update: {
      theme: fields.theme,
      preferredSimulator: fields.preferredSimulator,
      unitSystem: fields.unitSystem,
      preferredLeaderboardView: fields.preferredLeaderboardView,
      preferredMapMode: fields.preferredMapMode,
      homeFeedMode: fields.homeFeedMode,
      homeFeedSimulator: fields.homeFeedSimulator,
      homeFeedCompetitionClass: fields.homeFeedCompetitionClass
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "PREFERENCE_UPDATE",
    targetType: "UserPreference",
    targetId: session.user.id,
    summary: "User preferences were updated.",
    metadata: {
      theme: fields.theme,
      preferredSimulator: fields.preferredSimulator,
      unitSystem: fields.unitSystem,
      preferredLeaderboardView: fields.preferredLeaderboardView,
      preferredMapMode: fields.preferredMapMode,
      homeFeedMode: fields.homeFeedMode,
      homeFeedSimulator: fields.homeFeedSimulator,
      homeFeedCompetitionClass: fields.homeFeedCompetitionClass
    }
  });

  revalidatePath(`/${fields.locale}/profile`);
  revalidatePath(`/${fields.locale}`);

  redirect(`/${fields.locale}/profile?preferencesSaved=1`);
}
