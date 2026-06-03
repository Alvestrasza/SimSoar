import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {prisma} from "@/lib/db";
import {saveFlightAction} from "./save-flight-action";
import UploadIgcPreview from "@/app/components/UploadIgcPreview";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {hasRole} from "@/lib/rbac";
import {Link} from "@/i18n/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UploadPageProps = {
  params: Promise<{locale: string}>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export default async function UploadPage({
  params,
  searchParams
}: UploadPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Upload"});

  const queryParams = searchParams ? await searchParams : {};

  const uploadErrorParam = Array.isArray(queryParams.uploadError)
    ? queryParams.uploadError[0]
    : queryParams.uploadError;

  const uploadError =
    typeof uploadErrorParam === "string" ? uploadErrorParam : null;

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar upload auth session could not be loaded:", error);
  }

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const isPilot = hasRole(session.user.roles, "PILOT");

  if (!isPilot) {
    return (
      <main className="wrap" style={{maxWidth: 860}}>
        <div className="card">
          <div className="cardHead">
            <div>
              <span className="cardTitle">{t("pilotRequiredTitle")}</span>
              <p className="muted" style={{margin: "6px 0 0"}}>
                {t("pilotRequiredSubtitle")}
              </p>
            </div>
          </div>

          <div className="cardBody lineHeight">
            <p>{t("pilotRequiredText")}</p>

            <p className="muted">{t("pilotRequiredMace")}</p>

            <p style={{marginTop: 22}}>
              <Link className="btn btnSecondary" href="/profile">
                {t("openProfile")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  const [profile, preferences] = await Promise.all([
    prisma.pilotProfile.findUnique({
      where: {
        userId: session.user.id
      }
    }),
    prisma.userPreference.findUnique({
      where: {
        userId: session.user.id
      }
    })
  ]);

  return (
    <main className="wrap" style={{maxWidth: 860}}>
      <div className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("pageTitle")}</span>
          <span className="muted">{t("fileHint")}</span>
        </div>
        {uploadError ? (
          <div
            className="cardBody"
            style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--orange-lt)"
            }}
          >
            <strong>{t("uploadErrorTitle")}</strong>
            <p style={{margin: "6px 0 0"}}>
              {t(`uploadError_${uploadError}`)}
            </p>
          </div>
        ) : null}
        <form className="cardBody" action={saveFlightAction}>
          <input type="hidden" name="locale" value={locale} />

          <UploadIgcPreview />

          <div className="formGrid" style={{marginTop: 20}}>
            <div className="formGroup">
              <label>{t("pilotCallsign")}</label>
              <input
                name="pilotCallsign"
                defaultValue={profile?.callsign ?? ""}
                required
              />
            </div>

            <div className="formGroup">
              <label>{t("simulator")}</label>
              <select
                name="simulator"
                defaultValue={preferences?.preferredSimulator ?? profile?.favoriteSim ?? "MSFS 2024"}
              >
                <option>MSFS 2024</option>
                <option>MSFS 2020</option>
                <option>Condor 2</option>
                <option>X-Plane 12</option>
                <option>X-Plane 11</option>
                <option>DCS World</option>
                <option value="Sonstiger">{t("simOther")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("registration")}</label>
              <input
                name="registration"
                placeholder={t("registrationPlaceholder")}
              />
            </div>

            <div className="formGroup">
              <label>{t("gliderInput")}</label>
              <input
                name="glider"
                placeholder={t("gliderPlaceholder")}
              />
            </div>

            <div className="formGroup">
              <label>{t("competitionClass")}</label>
              <select name="competitionClass">
                <option value="Club Klasse">{t("classClub")}</option>
                <option value="15 m Klasse">{t("class15m")}</option>
                <option value="18 m Klasse">{t("class18m")}</option>
                <option value="Offene Klasse">{t("classOpen")}</option>
                <option value="Doppelsitzer">{t("classTwoSeater")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("visibility")}</label>
              <select name="visibility">
                <option value="PUBLIC">{t("visibilityPublic")}</option>
                <option value="PRIVATE">{t("visibilityPrivate")}</option>
                <option value="UNLISTED">{t("visibilityUnlisted")}</option>
              </select>
            </div>

            <div className="formGroup full">
              <label>{t("comment")}</label>
              <textarea
                name="comment"
                placeholder={t("commentPlaceholder")}
              />
            </div>
          </div>

          <p style={{marginTop: 20}}>
            <button className="btn btnSuccess" type="submit">
              {t("submit")}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}
