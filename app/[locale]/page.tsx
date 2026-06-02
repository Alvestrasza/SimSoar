import {prisma} from "@/lib/db";
import {Link} from "@/i18n/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import HomeMapPreview from "@/app/components/HomeMapPreview";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: HomePageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Home"});

  const [totalFlights, totalPilots, best] = await Promise.all([
    prisma.flight.count({
      where: {
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        deletedAt: null
      }
    }),
    prisma.pilotProfile.count(),
    prisma.flight.findFirst({
      where: {
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        deletedAt: null
      },
      orderBy: {distanceKm: "desc"}
    })
  ]);

  const recent = await prisma.flight.findMany({
    where: {
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      deletedAt: null
    },
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
  });

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
        <section className="grid grid3" style={{marginBottom: 34}}>
          <div className="card featureTile">
            <div className="featureIcon">📂</div>
            <h3>{t("featureUploadTitle")}</h3>
            <p className="muted">{t("featureUploadText")}</p>
          </div>

          <div className="card featureTile">
            <div className="featureIcon">🌡️</div>
            <h3>{t("featureThermalTitle")}</h3>
            <p className="muted">{t("featureThermalText")}</p>
          </div>

          <div className="card featureTile">
            <div className="featureIcon">🔐</div>
            <h3>{t("featureMultiUserTitle")}</h3>
            <p className="muted">{t("featureMultiUserText")}</p>
          </div>
        </section>

        <div className="card">
          <div className="cardHead">
            <span className="cardTitle">{t("recentFlights")}</span>

            <Link className="muted" href="/flights">
              {t("viewAll")}
            </Link>
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
