import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPilotsPageProps = {
  params: Promise<{locale: string}>;
};

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export default async function AdminPilotsPage({params}: AdminPilotsPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "AdminPilots"});

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  if (!hasRole(session.user.roles, "MODERATOR")) {
    notFound();
  }

  const [profiles, flightStats] = await Promise.all([
    prisma.pilotProfile.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      select: {
        id: true,
        userId: true,
        callsign: true,
        homeAirfield: true,
        favoriteSim: true,
        favoriteGlider: true,
        country: true,
        showHomeAirfieldOnHome: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.flight.groupBy({
      by: ["userId"],
      where: {
        deletedAt: null
      },
      _count: {
        id: true
      },
      _sum: {
        distanceKm: true,
        olcPoints: true
      },
      _max: {
        distanceKm: true,
        createdAt: true
      }
    })
  ]);

  const statsByUserId = new Map(
    flightStats.map((entry) => [entry.userId, entry])
  );

  return (
    <main className="wrap adminWrap">
      <section className="card">
        <div className="cardHead adminFlightsHeader">
          <div>
            <span className="cardTitle">{t("pageTitle")}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t("subtitle")}
            </p>
          </div>

          <Link className="btn btnSecondary" href="/admin">
            {t("backToAdmin")}
          </Link>
        </div>

        <div className="cardBody">
          {profiles.length === 0 ? (
            <p className="muted">{t("noPilots")}</p>
          ) : (
            <div className="moderationCardGrid">
              {profiles.map((profile) => {
                const stats = statsByUserId.get(profile.userId);
                const flightsCount = stats?._count.id ?? 0;
                const totalDistance = stats?._sum.distanceKm ?? 0;
                const totalOlc = stats?._sum.olcPoints ?? 0;
                const bestDistance = stats?._max.distanceKm ?? 0;
                const lastFlightAt = stats?._max.createdAt ?? null;

                return (
                  <article className="moderationCard" key={profile.id}>
                    <div className="moderationCardMain">
                      <div className="moderationCardTop">
                        <div>
                          <strong className="moderationFlightTitle">
                            {profile.callsign}
                          </strong>

                          <p className="muted moderationSubLine">
                            {profile.user?.name ?? t("unknownUser")}
                          </p>
                        </div>

                        <span className="moderationStatusBadge approved">
                          {flightsCount} {t("flightsShort")}
                        </span>
                      </div>

                      <div className="moderationMetaGrid">
                        <div>
                          <span>{t("homeAirfield")}</span>
                          <strong>{profile.homeAirfield ?? "–"}</strong>
                        </div>

                        <div>
                          <span>{t("country")}</span>
                          <strong>{profile.country ?? "–"}</strong>
                        </div>

                        <div>
                          <span>{t("favoriteSim")}</span>
                          <strong>{profile.favoriteSim ?? "–"}</strong>
                        </div>

                        <div>
                          <span>{t("favoriteGlider")}</span>
                          <strong>{profile.favoriteGlider ?? "–"}</strong>
                        </div>
                      </div>

                      <div className="moderationMetaGrid">
                        <div>
                          <span>{t("totalDistance")}</span>
                          <strong>{Math.round(totalDistance)} km</strong>
                        </div>

                        <div>
                          <span>{t("bestDistance")}</span>
                          <strong>{Math.round(bestDistance)} km</strong>
                        </div>

                        <div>
                          <span>{t("totalOlc")}</span>
                          <strong>{Math.round(totalOlc)}</strong>
                        </div>

                        <div>
                          <span>{t("lastFlight")}</span>
                          <strong>
                            {lastFlightAt ? formatDate(lastFlightAt, locale) : "–"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="moderationCardActions">
                      <div className="moderationMetaGrid">
                        <div>
                          <span>{t("createdAt")}</span>
                          <strong>{formatDate(profile.createdAt, locale)}</strong>
                        </div>

                        <div>
                          <span>{t("updatedAt")}</span>
                          <strong>{formatDate(profile.updatedAt, locale)}</strong>
                        </div>

                        <div>
                          <span>{t("showHomeAirfield")}</span>
                          <strong>
                            {profile.showHomeAirfieldOnHome
                              ? t("yes")
                              : t("no")}
                          </strong>
                        </div>
                      </div>

                      <Link
                        className="btn btnSecondary"
                        href={`/pilots`}
                      >
                        {t("openPublicPilots")}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
