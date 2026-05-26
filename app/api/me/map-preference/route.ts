import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ homeAirfield: null, preferHomeAirfield: false });
    }

    const profile = await prisma.pilotProfile.findUnique({
      where: { userId: session.user.id },
      select: { homeAirfield: true, showHomeAirfieldOnHome: true }
    });

    return NextResponse.json({
      homeAirfield: profile?.homeAirfield ?? null,
      preferHomeAirfield: profile?.showHomeAirfieldOnHome ?? false
    });
  } catch (error) {
    console.error("SimSoar map preference could not be loaded:", error);
    return NextResponse.json({ homeAirfield: null, preferHomeAirfield: false }, { status: 200 });
  }
}
