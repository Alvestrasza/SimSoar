import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {moderateFlightAction} from "./actions";
import AdminFlightDeleteButton from "@/app/components/AdminFlightDeleteButton";
import AdminFlightRestoreButton from "@/app/components/AdminFlightRestoreButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminFlightsPageProps = {
  params: Promise<{locale: string}>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function formatDate(value: Date | null, locale: string) {
  if (!value) {
    return "–";
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function moderationStatusClass(
  status: "APPROVED" | "REJECTED" | "HIDDEN" | "PENDING",
  isSoftDeleted: boolean
) {
  if (isSoftDeleted) return "moderationStatusBadge deleted";
  if (status === "APPROVED") return "moderationStatusBadge approved";
  if (status === "REJECTED") return "moderationStatusBadge rejected";
  if (status === "HIDDEN") return "moderationStatusBadge hidden";
  return "moderationStatusBadge pending";
}

export default async function AdminFlightsPage({
  params,
  searchParams
}: AdminFlightsPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "AdminFlights"});

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  if (!hasRole(session.user.roles, "MODERATOR")) {
    notFound();
  }

  const canDeleteFlights = hasRole(session.user.roles, "ADMIN");

  const queryParams = searchParams ? await searchParams : {};
  const updatedParam = Array.isArray(queryParams.updated)
    ? queryParams.updated[0]
    : queryParams.updated;

  const flights = await prisma.flight.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    select: {
      id: true,
      title: true,
      pilotCallsign: true,
      simulator: true,
      visibility: true,
      moderationStatus: true,
      moderationNote: true,
      distanceKm: true,
      olcPoints: true,
      createdAt: true,
      moderatedAt: true,
      deletedAt: true,
      deletedByUserId: true
    }
  });

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

        {updatedParam === "1" ? (
          <div className="cardBody">
            <p className="badge">{t("updated")}</p>
          </div>
        ) : null}

        <div className="cardBody">
          {flights.length === 0 ? (
            <p className="muted">{t("noFlights")}</p>
          ) : (
            <div className="moderationCardGrid">
              {flights.map((flight) => {
                const isSoftDeleted = flight.deletedAt !== null;

                return (
                  <article
                    className={`moderationCard ${isSoftDeleted ? "softDeleted" : ""}`}
                    key={flight.id}
                  >
                    <div className="moderationCardMain">
                      <div className="moderationCardTop">
                        <div>
                          <Link href={`/flights/${flight.id}`}>
                            <strong className="moderationFlightTitle">
                              {flight.title}
                            </strong>
                          </Link>

                          <p className="muted moderationSubLine">
                            {flight.pilotCallsign} · {flight.simulator}
                          </p>
                        </div>

                        <span
                          className={moderationStatusClass(
                            flight.moderationStatus,
                            isSoftDeleted
                          )}
                        >
                          {isSoftDeleted
                            ? t("softDeleted")
                            : t(`status_${flight.moderationStatus}`)}
                        </span>
                      </div>

                      <div className="moderationMetaGrid">
                        <div>
                          <span>{t("stats")}</span>
                          <strong>
                            {Math.round(flight.distanceKm)} km ·{" "}
                            {Math.round(flight.olcPoints)} OLC
                          </strong>
                        </div>

                        <div>
                          <span>{t("visibility")}</span>
                          <strong>{t(`visibility_${flight.visibility}`)}</strong>
                        </div>

                        <div>
                          <span>{t("createdAt")}</span>
                          <strong>{formatDate(flight.createdAt, locale)}</strong>
                        </div>

                        <div>
                          <span>{t("status")}</span>
                          <strong>
                            {isSoftDeleted
                              ? t("softDeleted")
                              : t(`status_${flight.moderationStatus}`)}
                          </strong>
                        </div>
                      </div>

                      {isSoftDeleted ? (
                        <div className="moderationNotice">
                          <strong>{t("softDeleted")}</strong>
                          <p className="muted">{t("softDeletedHint")}</p>
                          <p className="muted">
                            {formatDate(flight.deletedAt, locale)}
                          </p>
                        </div>
                      ) : flight.moderationNote ? (
                        <div className="moderationNotice">
                          <strong>{t("moderationNotePlaceholder")}</strong>
                          <p className="muted">{flight.moderationNote}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="moderationCardActions">
                      {!isSoftDeleted ? (
                        <form
                          className="adminActionForm moderationActionForm"
                          action={moderateFlightAction}
                        >
                          <input
                            type="hidden"
                            name="flightId"
                            value={flight.id}
                          />

                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/${locale}/admin/flights`}
                          />

                          <select
                            name="moderationStatus"
                            defaultValue={flight.moderationStatus}
                          >
                            <option value="APPROVED">
                              {t("status_APPROVED")}
                            </option>
                            <option value="HIDDEN">
                              {t("status_HIDDEN")}
                            </option>
                            <option value="REJECTED">
                              {t("status_REJECTED")}
                            </option>
                          </select>

                          <textarea
                            name="moderationNote"
                            placeholder={t("moderationNotePlaceholder")}
                            defaultValue={flight.moderationNote ?? ""}
                          />

                          <button
                            className="btn btnPrimary btnSmall"
                            type="submit"
                          >
                            {t("save")}
                          </button>
                        </form>
                      ) : null}
                      
                      {canDeleteFlights && isSoftDeleted ? (
                        <AdminFlightRestoreButton
                          flightId={flight.id}
                          flightTitle={flight.title}
                          returnTo={`/${locale}/admin/flights`}
                        />
                      ) : null}
                      
                      {canDeleteFlights ? (
                        <AdminFlightDeleteButton
                          flightId={flight.id}
                          flightTitle={flight.title}
                          returnTo={`/${locale}/admin/flights`}
                          isSoftDeleted={isSoftDeleted}
                        />
                      ) : null}
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
