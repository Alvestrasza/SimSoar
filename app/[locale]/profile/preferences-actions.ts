"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";

const preferencesSchema = z.object({
  locale: z.enum(["de", "en"]).default("de"),
  theme: z.enum(["SYSTEM", "LIGHT", "DARK"])
});

export async function savePreferencesAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  const fields = preferencesSchema.parse({
    locale: formData.get("locale") || "de",
    theme: formData.get("theme")
  });

  await prisma.userPreference.upsert({
    where: {
      userId: session.user.id
    },
    create: {
      userId: session.user.id,
      theme: fields.theme
    },
    update: {
      theme: fields.theme
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
      theme: fields.theme
    }
  });

  revalidatePath(`/${fields.locale}/profile`);
  revalidatePath(`/${fields.locale}`);

  redirect(`/${fields.locale}/profile?preferencesSaved=1`);
}
