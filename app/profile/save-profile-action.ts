"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  callsign: z.string().min(2).max(40),
  homeAirfield: z.string().max(120).optional(),
  favoriteSim: z.string().max(40).optional(),
  favoriteGlider: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  bio: z.string().max(2000).optional(),
  showHomeAirfieldOnHome: z.boolean().default(false)
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
    showHomeAirfieldOnHome: formData.get("showHomeAirfieldOnHome") === "on"
  });

  await prisma.pilotProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data
  });

  redirect("/profile?saved=1");
}
