import {prisma} from "@/lib/db";
import FlightsExplorer from "@/app/components/FlightsExplorer";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {auth} from "@/auth";

export const dynamic = "force-dynamic";

type FlightsPageProps = {
  params: Promise<{locale: string}>;
};

function leaderboardPreferenceToFilter(
  value: "ALL" | "MSFS" | "CONDOR" | "XPLANE" | null | undefined
) {
  if (value === "MSFS") return "msfs";
  if (value === "CONDOR") return "condor";
  if (value === "XPLANE") return "xplane";
  return "all";
}

export default async function FlightsPage({params}: FlightsPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Flights"});

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar flights auth session could not be loaded:", error);
  }

  const preferences = session?.user?.id
    ? await prisma.userPreference.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          preferredLeaderboardView: true
        }
      })
    : null;

  const initialFilter = leaderboardPreferenceToFilter(
    preferences?.preferredLeaderboardView
  );

  const flights = await prisma.flight.findMany({
    where: {
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      deletedAt: null
    },
    orderBy: [{olcPoints: "desc"}, {distanceKm: "desc"}],
    take: 100,
    include: {
      track: {
        orderBy: {seq: "asc"},
        take: 220
      }
    }
  });

  return (
    <main className="wrap">
      <div className="sectionHead">
        <span className="cardTitle">{t("pageTitle")}</span>
      </div>

      <FlightsExplorer
        initialFilter={initialFilter}
        flights={flights.map((f: any) => ({
          id: f.id,
          title: f.title,
          pilotCallsign: f.pilotCallsign,
          simulator: f.simulator,
          glider: f.glider,
          registration: f.registration,
          distanceKm: f.distanceKm,
          olcPoints: f.olcPoints,
          avgSpeedKmh: f.avgSpeedKmh,
          maxVarioMs: f.maxVarioMs,
          durationSeconds: f.durationSeconds,
          createdAt: f.createdAt.toISOString(),
          track: f.track.map((p: any) => ({
            lat: p.lat,
            lon: p.lon,
            altM: p.altM
          }))
        }))}
      />
    </main>
  );
}
