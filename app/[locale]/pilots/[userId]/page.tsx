import FollowPilotButton from "@/app/components/FollowPilotButton";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import BadgeGallery from "@/app/components/BadgeGallery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PilotProfilePageProps = {
  params: Promise<{locale: string; userId: string}>;
};

export default async function PilotProfilePage({params}: PilotProfilePageProps) {
  const {locale, userId} = await params;
  const supportedLocale = locale === "en" ? "en" : "de";

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Pilots"});

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar pilot profile session could not be loaded:", error);
  }

  const [pilot, followerCount, followingCount, followRelationship] =
    await Promise.all([
      prisma.user.findFirst({
        where: {id: userId, profile: {isNot: null}},
        select: {
          id: true,
          profile: true,
          flights: {
            where: {
              visibility: "PUBLIC",
              moderationStatus: "APPROVED",
              deletedAt: null
            },
            orderBy: {createdAt: "desc"},
            take: 20,
            select: {
              id: true,
              title: true,
              simulator: true,
              glider: true,
              distanceKm: true,
              olcPoints: true,
              createdAt: true
            }
          },
          badges: {
            where: {badge: {enabled: true}},
            orderBy: {badge: {sortOrder: "asc"}},
            select: {awardedAt: true, badge: {select: {code: true, icon: true}}}
          }
        }
      }),
      prisma.pilotFollow.count({where: {followingId: userId}}),
      prisma.pilotFollow.count({where: {followerId: userId}}),
      session?.user?.id
        ? prisma.pilotFollow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: userId
              }
            },
            select: {id: true}
          })
        : Promise.resolve(null)
    ]);

  if (!pilot?.profile) notFound();

  const totalDistance = pilot.flights.reduce(
    (sum, flight) => sum + flight.distanceKm,
    0
  );
  const totalOlc = pilot.flights.reduce(
    (sum, flight) => sum + flight.olcPoints,
    0
  );

  return (
    <main className="wrap">
      <p>
        <Link className="btn btnSecondary" href="/pilots">
          {t("backToPilots")}
        </Link>
      </p>

      <section className="card" style={{marginBottom: 24}}>
        <div className="cardHead">
          <span className="cardTitle">{pilot.profile.callsign}</span>
          {session?.user?.id && session.user.id !== pilot.id ? (
            <FollowPilotButton
              pilotUserId={pilot.id}
              locale={supportedLocale}
              isFollowing={Boolean(followRelationship)}
              returnTo={`/${supportedLocale}/pilots/${pilot.id}`}
              followLabel={t("follow")}
              unfollowLabel={t("unfollow")}
            />
          ) : null}
        </div>

        <div className="cardBody">
          <div className="grid grid3 pilotProfileStats">
            <div><strong>{pilot.flights.length}</strong><span>{t("flights")}</span></div>
            <div><strong>{Math.round(totalDistance)} km</strong><span>{t("totalDistance")}</span></div>
            <div><strong>{Math.round(totalOlc)}</strong><span>{t("totalOlc")}</span></div>
            <div><strong>{followerCount}</strong><span>{t("followers")}</span></div>
            <div><strong>{followingCount}</strong><span>{t("following")}</span></div>
          </div>

          {pilot.profile.bio ? <p>{pilot.profile.bio}</p> : null}

          <p className="muted">
            {[pilot.profile.country, pilot.profile.favoriteSim, pilot.profile.favoriteGlider]
              .filter(Boolean)
              .join(" · ") || t("profileDetailsEmpty")}
          </p>
          <BadgeGallery locale={supportedLocale} badges={pilot.badges} />
        </div>
      </section>

      <section className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("publicFlightsTitle")}</span>
        </div>
        <div className="cardBody grid grid3">
          {pilot.flights.length === 0 ? (
            <p className="muted">{t("noPublicFlights")}</p>
          ) : (
            pilot.flights.map((flight) => (
              <Link
                className="card featureTile"
                href={`/flights/${flight.id}`}
                key={flight.id}
              >
                <strong>{flight.title}</strong>
                <p className="muted">
                  {flight.simulator}{flight.glider ? ` · ${flight.glider}` : ""}
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
    </main>
  );
}
