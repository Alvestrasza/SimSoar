import { NextResponse } from "next/server";
import { saveProfileData } from "@/app/profile/save-profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();

  await saveProfileData(formData);

  return NextResponse.redirect(new URL("/profile?saved=1", request.url), {
    status: 303
  });
}