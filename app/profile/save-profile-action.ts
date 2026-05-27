"use server";

import { redirect } from "next/navigation";
import { saveProfileData } from "./save-profile-service";

export async function saveProfileAction(formData: FormData) {
  await saveProfileData(formData);
  redirect("/profile?saved=1");
}