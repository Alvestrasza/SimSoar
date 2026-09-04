import {prisma} from "@/lib/db";
import {Link} from "@/i18n/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import HomeMapPreview from "@/app/components/HomeMapPreview";
import {auth} from "@/auth";
import {buildHomeFeedWhere} from "@/lib/home-feed";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: HomePageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Home"});

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar home session could not be loaded:", error);
  }

  const preferences = session?.user?.id
    ? await prisma.userPreference.findUnique({
        where: {userId: session.user.id},
        select: {
          homeFeedMode: true,
          homeFeedSimulator: true,
          homeFeedCompetitionClass: true
        }
      })
    : null;

  const feedWhere = buildHomeFeedWhere(session?.user?.id, preferences);

  const [totalFlights, pilotGroups, best, recent] = await Promise.all([
    prisma.flight.count({
      where: feedWhere
    }),
    prisma.flight.groupBy({
      by: ["userId"],
      where: feedWhere
    }),
    prisma.flight.findFirst({
      where: feedWhere,
      orderBy: {distanceKm: "desc"}
    }),
    prisma.flight.findMany({
      where: feedWhere,
      orderBy: {createdAt: "desc"},
      take: 6,
      select: {
        id: true,
        title: true,
        pilotCallsign: true,
        simulator: true,
        distanceKm: true,
        olcPoints: true,
        avgSpeedKmh: true,
        createdAt: true
      }
    })
  ]);

  const totalPilots = pilotGroups.length;
  const effectiveFeedMode = session?.user?.id
    ? preferences?.homeFeedMode ?? "PUBLIC"
    : "PUBLIC";
  const feedModeLabel =
    effectiveFeedMode === "OWN"
      ? t("feedOwn")
      : effectiveFeedMode === "FOLLOWING"
        ? t("feedFollowing")
        : t("feedPublic");

  return (
    <>
      <section className="hero">
        <div className="heroInner">
          <div>
            <span className="kicker">{t("kicker")}</span>

            <h1>
              {t("heroTitleLine1")}
              <br />
              <span>{t("heroTitleLine2")}</span>
            </h1>

            <p className="heroSub">{t("heroSubtitle")}</p>

            <p style={{display: "flex", gap: 12, marginTop: 28}}>
              <Link className="btn btnPrimary" href="/upload">
                {t("uploadButton")}
              </Link>

              <Link className="btn btnSecondary" href="/flights">
                {t("leaderboardButton")}
              </Link>
            </p>

            <div className="heroStats">
              <div>
                <span className="statValue">{totalFlights}</span>
                <br />
                <span className="statLabel">{t("statsFlights")}</span>
              </div>

              <div>
                <span className="statValue">{totalPilots}</span>
                <br />
                <span className="statLabel">{t("statsPilots")}</span>
              </div>

              <div>
                <span className="statValue">
                  {best ? `${Math.round(best.distanceKm)} km` : "–"}
                </span>
                <br />
                <span className="statLabel">{t("statsBestDistance")}</span>
              </div>
            </div>
          </div>

          <div className="card heroMapCard">
            <HomeMapPreview
              homeAirfield={null}
              preferHomeAirfield={false}
            />
          </div>
        </div>
      </section>

      <main className="wrap">
        <div className="card">
          <div className="cardHead">
            <div>
              <span className="cardTitle">{t("recentFlights")}</span>
              <span className="muted homeFeedScope">{feedModeLabel}</span>
            </div>

            <div className="homeFeedLinks">
              {session?.user?.id ? (
                <Link className="muted" href="/profile">
                  {t("configureFeed")}
                </Link>
              ) : null}
              <Link className="muted" href="/flights">
                {t("viewAll")}
              </Link>
            </div>
          </div>

          <div className="cardBody grid grid3">
            {recent.length === 0 ? (
              <p className="muted">{t("noFlights")}</p>
            ) : (
              recent.map((f: any) => (
                <Link key={f.id} className="card featureTile" href={`/flights/${f.id}`}>
                  <strong>{f.title}</strong>
                  <p className="muted">
                    {f.pilotCallsign} · {f.simulator}
                  </p>
                  <p>
                    <strong>{Math.round(f.distanceKm)} km</strong> ·{" "}
                    {Math.round(f.olcPoints)} OLC ·{" "}
                    {Math.round(f.avgSpeedKmh)} km/h
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
