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
    recentAuditCount
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
    prisma.auditLog.count()
  ]);

  return (
    <main className="wrap">
      <section className="card" style={{marginBottom: 22}}>
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t("pageTitle")}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="cardBody grid grid3">
          <div className="card featureTile">
            <h3>{t("usersTitle")}</h3>
            <p className="statValue">{usersCount}</p>
            <p className="muted">{t("usersText")}</p>
            <p className="muted">{t("comingSoon")}</p>
          </div>

          <div className="card featureTile">
            <h3>{t("pilotsTitle")}</h3>
            <p className="statValue">{pilotsCount}</p>
            <p className="muted">{t("pilotsText")}</p>
            <p className="muted">{t("comingSoon")}</p>
          </div>

          <div className="card featureTile">
            <h3>{t("flightsTitle")}</h3>
            <p className="statValue">{flightsCount}</p>
            <p className="muted">{t("flightsText")}</p>
            <p>
              <Link className="btn btnPrimary" href="/admin/flights">
                {t("openFlightModeration")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid3">
        <div className="card featureTile">
          <h3>{t("approvedFlights")}</h3>
          <p className="statValue">{approvedFlightsCount}</p>
        </div>

        <div className="card featureTile">
          <h3>{t("hiddenFlights")}</h3>
          <p className="statValue">{hiddenFlightsCount}</p>
        </div>

        <div className="card featureTile">
          <h3>{t("rejectedFlights")}</h3>
          <p className="statValue">{rejectedFlightsCount}</p>
        </div>

        <div className="card featureTile">
          <h3>{t("auditTitle")}</h3>
          <p className="statValue">{recentAuditCount}</p>
          <p className="muted">{t("auditText")}</p>

          {canViewAudit ? (
            <p>
              <Link className="btn btnPrimary" href="/admin/audit">
                {t("openAuditLog")}
              </Link>
            </p>
          ) : (
            <p className="muted">{t("auditRestricted")}</p>
          )}
        </div>
      </section>
    </main>
  );
}
