import {auth} from "@/auth";
import FollowPilotButton from "@/app/components/FollowPilotButton";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {buildFollowedPublicFlightsWhere} from "@/lib/pilot-follow";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PilotsPageProps = {
  params: Promise<{locale: string}>;
};

type PilotRow = {
  userId: string;
  callsign: string;
  flightsCount: number;
  totalDistance: number;
  bestDistance: number;
  totalOlc: number;
  favoriteSim: string | null;
};

function favoriteSimulator(simulators: string[]) {
  const counts = new Map<string, number>();

  for (const simulator of simulators) {
    counts.set(simulator, (counts.get(simulator) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function getPilots(loadError: string) {
  try {
    const users = await prisma.user.findMany({
      where: {
        profile: {isNot: null},
        flights: {
          some: {
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            deletedAt: null
          }
        }
      },
      select: {
        id: true,
        profile: {select: {callsign: true, favoriteSim: true}},
        flights: {
          where: {
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            deletedAt: null
          },
          select: {distanceKm: true, olcPoints: true, simulator: true}
        }
      }
    });

    const pilots: PilotRow[] = users
      .filter((user) => user.profile)
      .map((user) => {
        const distances = user.flights.map((flight) => flight.distanceKm ?? 0);
        const olc = user.flights.map((flight) => flight.olcPoints ?? 0);

        return {
          userId: user.id,
          callsign: user.profile!.callsign,
          flightsCount: user.flights.length,
          totalDistance: distances.reduce((sum, value) => sum + value, 0),
          bestDistance: Math.max(0, ...distances),
          totalOlc: olc.reduce((sum, value) => sum + value, 0),
          favoriteSim:
            user.profile!.favoriteSim ??
            favoriteSimulator(user.flights.map((flight) => flight.simulator))
        };
      })
      .sort(
        (a, b) =>
          b.totalOlc - a.totalOlc ||
          b.bestDistance - a.bestDistance ||
          a.callsign.localeCompare(b.callsign)
      );

    return {pilots, error: null};
  } catch (error) {
    console.error("SimSoar pilots page failed to load:", error);
    return {pilots: [] as PilotRow[], error: loadError};
  }
}

export default async function PilotsPage({params}: PilotsPageProps) {
  const {locale} = await params;
  const supportedLocale = locale === "en" ? "en" : "de";

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Pilots"});

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar pilots session could not be loaded:", error);
  }

  const [{pilots, error}, followed, personalFeed] = await Promise.all([
    getPilots(t("loadError")),
    session?.user?.id
      ? prisma.pilotFollow.findMany({
          where: {followerId: session.user.id},
          select: {followingId: true}
        })
      : Promise.resolve([]),
    session?.user?.id
      ? prisma.flight.findMany({
          where: buildFollowedPublicFlightsWhere(session.user.id),
          orderBy: {createdAt: "desc"},
          take: 12,
          select: {
            id: true,
            title: true,
            pilotCallsign: true,
            simulator: true,
            distanceKm: true,
            olcPoints: true,
            createdAt: true
          }
        })
      : Promise.resolve([])
  ]);

  const followedIds = new Set(followed.map((entry) => entry.followingId));

  return (
    <main className="wrap">
      {session?.user?.id ? (
        <section className="card" style={{marginBottom: 24}}>
          <div className="cardHead">
            <span className="cardTitle">{t("personalFeedTitle")}</span>
          </div>
          <div className="cardBody grid grid3">
            {personalFeed.length === 0 ? (
              <p className="muted">{t("personalFeedEmpty")}</p>
            ) : (
              personalFeed.map((flight) => (
                <Link
                  className="card featureTile"
                  href={`/flights/${flight.id}`}
                  key={flight.id}
                >
                  <strong>{flight.title}</strong>
                  <p className="muted">
                    {flight.pilotCallsign} · {flight.simulator}
                  </p>
                  <p>
                    <strong>{Math.round(flight.distanceKm)} km</strong> ·{" "}
                    {Math.round(flight.olcPoints)} OLC
                  </p>
                </Link>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("pageTitle")}</span>
        </div>

        {error ? (
          <div className="cardBody"><p className="muted">{error}</p></div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t("rank")}</th>
                  <th>{t("pilot")}</th>
                  <th>{t("flights")}</th>
                  <th>{t("totalDistance")}</th>
                  <th>{t("bestDistance")}</th>
                  <th>{t("totalOlc")}</th>
                  <th>{t("favoriteSim")}</th>
                  {session?.user?.id ? <th>{t("followState")}</th> : null}
                </tr>
              </thead>

              <tbody>
                {pilots.length === 0 ? (
                  <tr>
                    <td colSpan={session?.user?.id ? 8 : 7} className="emptyTable">
                      {t("noPublicFlights")}
                    </td>
                  </tr>
                ) : (
                  pilots.map((pilot, index) => (
                    <tr key={pilot.userId}>
                      <td><strong>{index + 1}</strong></td>
                      <td>
                        <Link href={`/pilots/${pilot.userId}`}>{pilot.callsign}</Link>
                      </td>
                      <td>{pilot.flightsCount}</td>
                      <td>{Math.round(pilot.totalDistance)} km</td>
                      <td>{Math.round(pilot.bestDistance)} km</td>
                      <td>{Math.round(pilot.totalOlc)}</td>
                      <td>{pilot.favoriteSim ?? "–"}</td>
                      {session?.user?.id ? (
                        <td>
                          {session.user.id === pilot.userId ? (
                            <span className="muted">{t("ownProfile")}</span>
                          ) : (
                            <FollowPilotButton
                              pilotUserId={pilot.userId}
                              locale={supportedLocale}
                              isFollowing={followedIds.has(pilot.userId)}
                              returnTo={`/${supportedLocale}/pilots`}
                              followLabel={t("follow")}
                              unfollowLabel={t("unfollow")}
                            />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
