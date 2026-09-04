"use server";

import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const notificationSchema = z.object({
  notificationId: z.string().min(1).max(64),
  locale: z.enum(["de", "en"]).default("de")
});

function revalidateNotifications(locale: "de" | "en") {
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/notifications`);
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");

  const fields = notificationSchema.parse({
    notificationId: formData.get("notificationId"),
    locale: formData.get("locale") || "de"
  });

  await prisma.notification.updateMany({
    where: {
      id: fields.notificationId,
      userId: session.user.id,
      readAt: null
    },
    data: {readAt: new Date()}
  });

  revalidateNotifications(fields.locale);
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");
  const locale = formData.get("locale") === "en" ? "en" : "de";

  await prisma.notification.updateMany({
    where: {userId: session.user.id, readAt: null},
    data: {readAt: new Date()}
  });

  revalidateNotifications(locale);
}
