import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPageProps = {
  params: Promise<{locale: string}>;
};

export default async function AdminPage({params}: AdminPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Admin"});

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const canUseAdmin = hasRole(session.user.roles, "MODERATOR");
  const canViewAudit = hasRole(session.user.roles, "ADMIN");

  if (!canUseAdmin) {
    notFound();
  }

  const [
    usersCount,
    pilotsCount,
    flightsCount,
    approvedFlightsCount,
    hiddenFlightsCount,
    rejectedFlightsCount,
    recentAuditCount,
    blockedIgcCount,
    airspaceCount,
    enabledBadgeCount
  ] = await Promise.all([
    prisma.user.count(),
    prisma.pilotProfile.count(),
    prisma.flight.count({
      where: {
        deletedAt: null
      }
    }),
    prisma.flight.count({
      where: {
        moderationStatus: "APPROVED",
        deletedAt: null
      }
    }),
    prisma.flight.count({
      where: {
        moderationStatus: "HIDDEN",
        deletedAt: null
      }
    }),
    prisma.flight.count({
      where: {
        moderationStatus: "REJECTED",
        deletedAt: null
      }
    }),
    prisma.auditLog.count(),
    prisma.igcUploadBlock.count(),
    prisma.airspace.count(),
    prisma.badgeDefinition.count({where: {enabled: true}})
  ]);

  return (
    <main className="wrap adminWrap">
      <section className="card adminHeroCard">
        <div>
          <span className="adminEyebrow">SimSoar Control</span>
          <h1 className="adminHeroTitle">{t("pageTitle")}</h1>
          <p className="muted adminHeroText">{t("subtitle")}</p>
        </div>

        <div className="adminHeroStats">
          <div>
            <span>{t("usersTitle")}</span>
            <strong>{usersCount}</strong>
          </div>

          <div>
            <span>{t("pilotsTitle")}</span>
            <strong>{pilotsCount}</strong>
          </div>

          <div>
            <span>{t("flightsTitle")}</span>
            <strong>{flightsCount}</strong>
          </div>
        </div>
      </section>

      <section className="adminSection">
        <div className="sectionHead compact">
          <span className="cardTitle">{t("comingSoon")}</span>
        </div>

        <div className="adminDashboardGrid">
          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">👥</span>
              <h3>{t("usersTitle")}</h3>
              <p className="statValue">{usersCount}</p>
              <p className="muted">{t("usersText")}</p>
            </div>

            <Link className="btn btnPrimary" href="/admin/users">
              {t("openUserAdmin")}
            </Link>
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">🛩️</span>
              <h3>{t("pilotsTitle")}</h3>
              <p className="statValue">{pilotsCount}</p>
              <p className="muted">{t("pilotsText")}</p>
            </div>

            <Link className="btn btnPrimary" href="/admin/pilots">
              {t("openPilotAdmin")}
            </Link>
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">📋</span>
              <h3>{t("flightsTitle")}</h3>
              <p className="statValue">{flightsCount}</p>
              <p className="muted">{t("flightsText")}</p>
            </div>

            <Link className="btn btnPrimary" href="/admin/flights">
              {t("openFlightModeration")}
            </Link>
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">🗺️</span>
              <h3>{t("airspacesTitle")}</h3>
              <p className="statValue">{airspaceCount}</p>
              <p className="muted">{t("airspacesText")}</p>
            </div>

            {canViewAudit ? (
              <Link className="btn btnPrimary" href="/admin/airspaces">
                {t("openAirspaces")}
              </Link>
            ) : (
              <p className="muted">{t("auditRestricted")}</p>
            )}
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">🏅</span>
              <h3>{t("badgesTitle")}</h3>
              <p className="statValue">{enabledBadgeCount}</p>
              <p className="muted">{t("badgesText")}</p>
            </div>

            {canViewAudit ? <Link className="btn btnPrimary" href="/admin/badges">
              {t("openBadges")}
            </Link> : <p className="muted">{t("auditRestricted")}</p>}
          </div>
        </div>
      </section>

      <section className="adminSection">
        <div className="adminDashboardGrid">
          <div className="card adminMetricTile">
            <span>{t("approvedFlights")}</span>
            <strong>{approvedFlightsCount}</strong>
          </div>

          <div className="card adminMetricTile">
            <span>{t("hiddenFlights")}</span>
            <strong>{hiddenFlightsCount}</strong>
          </div>

          <div className="card adminMetricTile">
            <span>{t("rejectedFlights")}</span>
            <strong>{rejectedFlightsCount}</strong>
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">🧾</span>
              <h3>{t("auditTitle")}</h3>
              <p className="statValue">{recentAuditCount}</p>
              <p className="muted">{t("auditText")}</p>
            </div>

            {canViewAudit ? (
              <Link className="btn btnPrimary" href="/admin/audit">
                {t("openAuditLog")}
              </Link>
            ) : (
              <p className="muted">{t("auditRestricted")}</p>
            )}
          </div>

          <div className="card adminDashboardTile">
            <div>
              <span className="adminTileIcon">🔐</span>
              <h3>{t("igcBlocksTitle")}</h3>
              <p className="statValue">{blockedIgcCount}</p>
              <p className="muted">{t("igcBlocksText")}</p>
            </div>

            {canViewAudit ? (
              <Link className="btn btnPrimary" href="/admin/igc-blocks">
                {t("openIgcBlocks")}
              </Link>
            ) : (
              <p className="muted">{t("auditRestricted")}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
