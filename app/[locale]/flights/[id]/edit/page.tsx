import {notFound, redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {Link} from "@/i18n/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {updateFlightMetadataAction} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EditFlightPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export default async function EditFlightPage({
  params,
  searchParams
}: EditFlightPageProps) {
  const {locale, id} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "FlightEdit"});

  const queryParams = searchParams ? await searchParams : {};

  const replaceErrorParam = Array.isArray(queryParams.replaceError)
    ? queryParams.replaceError[0]
    : queryParams.replaceError;

  const replaceError =
    typeof replaceErrorParam === "string" ? replaceErrorParam : null;

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const flight = await prisma.flight.findUnique({
    where: {
      id
    },
    select: {
      id: true,
      userId: true,
      title: true,
      simulator: true,
      glider: true,
      registration: true,
      competitionClass: true,
      weatherMode: true,
      visibility: true,
      publicIgcDownloadEnabled: true,
      comment: true,
      moderationStatus: true,
      deletedAt: true
    }
  });

  if (!flight) {
    notFound();
  }

  const isOwner = flight.userId === session.user.id;
  const canAdminEdit = hasRole(session.user.roles, "ADMIN");

  const canOwnerEdit =
    isOwner &&
    flight.deletedAt === null &&
    flight.moderationStatus === "APPROVED";

  if (!canAdminEdit && !canOwnerEdit) {
    notFound();
  }

  return (
    <main className="wrap" style={{maxWidth: 860}}>
      <section className="card">
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t("pageTitle")}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t("subtitle")}
            </p>
          </div>

          <Link className="btn btnSecondary" href={`/flights/${flight.id}`}>
            {t("backToFlight")}
          </Link>
        </div>

        {replaceError ? (
          <div
            className="cardBody"
            style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--orange-lt)"
            }}
          >
            <strong>{t("replaceErrorTitle")}</strong>
            <p style={{margin: "6px 0 0"}}>
              {t(`replaceError_${replaceError}`)}
            </p>
          </div>
        ) : null}

        <form className="cardBody" action={updateFlightMetadataAction} encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="flightId" value={flight.id} />

          <div className="formGrid">
            <div className="formGroup full">
              <label>{t("replaceIgcFile")}</label>
              <input
                type="file"
                name="igc"
                accept=".igc,text/plain,application/octet-stream"
              />
              <p className="muted" style={{margin: "6px 0 0", fontSize: 13}}>
                {t("replaceIgcHint")}
              </p>
            </div>
            <div className="formGroup full">
              <label>{t("title")}</label>
              <input
                name="title"
                defaultValue={flight.title}
                required
                minLength={3}
                maxLength={160}
              />
            </div>

            <div className="formGroup">
              <label>{t("simulator")}</label>
              <select name="simulator" defaultValue={flight.simulator}>
                <option value="MSFS 2024">MSFS 2024</option>
                <option value="MSFS 2020">MSFS 2020</option>
                <option value="Condor 2">Condor 2</option>
                <option value="X-Plane 12">X-Plane 12</option>
                <option value="X-Plane 11">X-Plane 11</option>
                <option value="DCS World">DCS World</option>
                <option value="Other">{t("simOther")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("visibility")}</label>
              <select name="visibility" defaultValue={flight.visibility}>
                <option value="PUBLIC">{t("visibilityPublic")}</option>
                <option value="UNLISTED">{t("visibilityUnlisted")}</option>
                <option value="PRIVATE">{t("visibilityPrivate")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("publicIgcDownload")}</label>

              <label className="checkboxLine">
                <input
                  type="checkbox"
                  name="publicIgcDownloadEnabled"
                  defaultChecked={flight.publicIgcDownloadEnabled}
                />
                <span>{t("publicIgcDownloadEnabled")}</span>
              </label>

              <p className="muted" style={{margin: "6px 0 0", fontSize: 13}}>
                {t("publicIgcDownloadHint")}
              </p>
            </div>

            <div className="formGroup">
              <label>{t("glider")}</label>
              <input
                name="glider"
                defaultValue={flight.glider ?? ""}
                maxLength={80}
              />
            </div>

            <div className="formGroup">
              <label>{t("registration")}</label>
              <input
                name="registration"
                defaultValue={flight.registration ?? ""}
                maxLength={40}
              />
            </div>

            <div className="formGroup">
              <label>{t("competitionClass")}</label>
              <select
                name="competitionClass"
                defaultValue={flight.competitionClass ?? "Club Klasse"}
              >
                <option value="Club Klasse">{t("classClub")}</option>
                <option value="15 m Klasse">{t("class15m")}</option>
                <option value="18 m Klasse">{t("class18m")}</option>
                <option value="Offene Klasse">{t("classOpen")}</option>
                <option value="Doppelsitzer">{t("classTwoSeater")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("weatherMode")}</label>
              <select
                name="weatherMode"
                defaultValue={flight.weatherMode ?? "UNKNOWN"}
              >
                <option value="UNKNOWN">{t("weatherModeUnknown")}</option>
                <option value="LIVE">{t("weatherModeLive")}</option>
                <option value="PRESET">{t("weatherModePreset")}</option>
                <option value="CUSTOM">{t("weatherModeCustom")}</option>
              </select>
            </div>

            <div className="formGroup full">
              <label>{t("comment")}</label>
              <textarea
                name="comment"
                defaultValue={flight.comment ?? ""}
                maxLength={2000}
              />
            </div>
          </div>

          <p style={{marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap"}}>
            <button className="btn btnSuccess" type="submit">
              {t("save")}
            </button>

            <Link className="btn btnSecondary" href={`/flights/${flight.id}`}>
              {t("cancel")}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
