import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {moderateFlightAction} from "./actions";
import AdminFlightDeleteButton from "@/app/components/AdminFlightDeleteButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminFlightsPageProps = {
  params: Promise<{locale: string}>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
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
    where: {
      deletedAt: null
    },
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
      moderatedAt: true
    }
  });

  return (
    <main className="wrap">
      <section className="card">
        <div className="cardHead">
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

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t("flight")}</th>
                <th>{t("pilot")}</th>
                <th>{t("stats")}</th>
                <th>{t("visibility")}</th>
                <th>{t("status")}</th>
                <th>{t("createdAt")}</th>
                <th>{t("action")}</th>
              </tr>
            </thead>

            <tbody>
              {flights.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTable">
                    {t("noFlights")}
                  </td>
                </tr>
              ) : (
                flights.map((flight) => (
                  <tr key={flight.id}>
                    <td>
                      <Link href={`/flights/${flight.id}`}>
                        <strong>{flight.title}</strong>
                      </Link>
                      <br />
                      <span className="muted">{flight.simulator}</span>
                    </td>

                    <td>{flight.pilotCallsign}</td>

                    <td>
                      {Math.round(flight.distanceKm)} km
                      <br />
                      <span className="muted">
                        {Math.round(flight.olcPoints)} OLC
                      </span>
                    </td>

                    <td>{t(`visibility_${flight.visibility}`)}</td>

                    <td>
                      <strong>{t(`status_${flight.moderationStatus}`)}</strong>
                      {flight.moderationNote ? (
                        <>
                          <br />
                          <span className="muted">{flight.moderationNote}</span>
                        </>
                      ) : null}
                    </td>

                    <td>{formatDate(flight.createdAt, locale)}</td>

                    <td>
                      <form className="adminActionForm" action={moderateFlightAction}>
                        <input type="hidden" name="flightId" value={flight.id} />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`/${locale}/admin/flights`}
                        />

                        <select
                          name="moderationStatus"
                          defaultValue={flight.moderationStatus}
                        >
                          <option value="APPROVED">{t("status_APPROVED")}</option>
                          <option value="HIDDEN">{t("status_HIDDEN")}</option>
                          <option value="REJECTED">{t("status_REJECTED")}</option>
                        </select>

                        <textarea
                          name="moderationNote"
                          placeholder={t("moderationNotePlaceholder")}
                          defaultValue={flight.moderationNote ?? ""}
                        />

                        <button className="btn btnPrimary btnSmall" type="submit">
                          {t("save")}
                        </button>
                      </form>
                      
                      {canDeleteFlights ? (
                        <AdminFlightDeleteButton
                          flightId={flight.id}
                          flightTitle={flight.title}
                          returnTo={`/${locale}/admin/flights`}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
