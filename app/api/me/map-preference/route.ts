import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        homeAirfield: null,
        preferHomeAirfield: false,
        preferredMapMode: "STANDARD"
      });
    }

    const [profile, preferences] = await Promise.all([
      prisma.pilotProfile.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          homeAirfield: true,
          showHomeAirfieldOnHome: true
        }
      }),
      prisma.userPreference.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          preferredMapMode: true
        }
      })
    ]);

    return NextResponse.json({
      homeAirfield: profile?.homeAirfield ?? null,
      preferHomeAirfield: profile?.showHomeAirfieldOnHome ?? false,
      preferredMapMode: preferences?.preferredMapMode ?? "STANDARD"
    });
  } catch (error) {
    console.error("SimSoar map preference could not be loaded:", error);

    return NextResponse.json(
      {
        homeAirfield: null,
        preferHomeAirfield: false,
        preferredMapMode: "STANDARD"
      },
      {status: 200}
    );
  }
}
