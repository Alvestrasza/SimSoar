import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {prisma} from "@/lib/db";
import {saveProfileAction} from "./save-profile-action";
import {Link} from "@/i18n/navigation";
import {ProfileSaveNotice} from "./ProfileSaveNotice";
import FlightOwnerActions from "@/app/components/FlightOwnerActions";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {savePreferencesAction} from "./preferences-actions";
import {
  normalizeSimSoarRoles,
  SIMSOAR_ROLE_ORDER,
  type SimSoarRole
} from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfilePageProps = {
  params: Promise<{locale: string}>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function visibilityLabel(
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED",
  t: Awaited<ReturnType<typeof getTranslations>>
) {
  if (visibility === "PUBLIC") return t("visibilityPublic");
  if (visibility === "PRIVATE") return t("visibilityPrivate");
  return t("visibilityUnlisted");
}

function getVisibleRoles(roles: readonly string[] | undefined): SimSoarRole[] {
  const assignedRoles = new Set(normalizeSimSoarRoles([...(roles ?? [])]));

  return SIMSOAR_ROLE_ORDER.filter((role) => assignedRoles.has(role));
}

export default async function ProfilePage({
  params,
  searchParams
}: ProfilePageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Profile"});

const queryParams = searchParams ? await searchParams : {};

const savedParam = Array.isArray(queryParams.saved)
  ? queryParams.saved[0]
  : queryParams.saved;

const flightUpdatedParam = Array.isArray(queryParams.flightUpdated)
  ? queryParams.flightUpdated[0]
  : queryParams.flightUpdated;

const flightDeletedParam = Array.isArray(queryParams.flightDeleted)
  ? queryParams.flightDeleted[0]
  : queryParams.flightDeleted;

const preferencesSavedParam = Array.isArray(queryParams.preferencesSaved)
  ? queryParams.preferencesSaved[0]
  : queryParams.preferencesSaved;

const noticeStatus =
  savedParam === "1"
    ? "saved"
    : preferencesSavedParam === "1"
      ? "preferencesSaved"
      : flightUpdatedParam === "1"
        ? "flightUpdated"
        : flightDeletedParam === "1"
          ? "flightDeleted"
          : null;

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar profile auth session could not be loaded:", error);
  }

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const visibleRoles = getVisibleRoles(session.user.roles);

  const [profile, preferences, flights] = await Promise.all([
    prisma.pilotProfile.findUnique({
      where: {
        userId: session.user.id
      }
    }),
    prisma.userPreference.findUnique({
      where: {
        userId: session.user.id
      }
    }),
    prisma.flight.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 20
    })
  ]);

  return (
    <main className="wrap" style={{maxWidth: 960}}>
      <div className="card" style={{marginBottom: 20}}>
        <div className="cardHead profileHeader">
          <span className="cardTitle">{t("pageTitle")}</span>

          <div className="roleStatusGroup" aria-label={t("roleStatusLabel")}>
            <span className="roleStatusText">{t("roleStatusLabel")}</span>

            {visibleRoles.map((role) => (
              <span className="roleStatusBadge" key={role}>
                {t(`role_${role}`)}
              </span>
            ))}
          </div>
        </div>

        <form className="cardBody" action={saveProfileAction}>
          <input type="hidden" name="locale" value={locale} />

          <div className="formGrid">
            <div className="formGroup">
              <label>{t("username")}</label>
              <input
                value={session.user.name ?? "–"}
                readOnly
                aria-readonly="true"
              />
            </div>

            <div className="formGroup">
              <label>{t("email")}</label>
              <input
                value={session.user.email ?? "–"}
                readOnly
                aria-readonly="true"
              />
            </div>

            <div className="formGroup">
              <label>{t("callsign")}</label>
              <input
                name="callsign"
                defaultValue={profile?.callsign ?? ""}
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_-]+"
                title={t("callsignTitle")}
              />
            </div>

            <div className="formGroup">
              <label>{t("homeAirfield")}</label>
              <input
                name="homeAirfield"
                defaultValue={profile?.homeAirfield ?? ""}
              />
            </div>

            <div className="formGroup">
              <label>{t("favoriteSim")}</label>
              <select
                name="favoriteSim"
                defaultValue={profile?.favoriteSim ?? "MSFS 2024"}
              >
                <option>MSFS 2024</option>
                <option>MSFS 2020</option>
                <option>Condor 2</option>
                <option>X-Plane 12</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("favoriteGlider")}</label>
              <input
                name="favoriteGlider"
                defaultValue={profile?.favoriteGlider ?? ""}
              />
            </div>

            <div className="formGroup">
              <label>{t("country")}</label>
              <input
                name="country"
                defaultValue={profile?.country ?? ""}
              />
            </div>

            <div className="formGroup full checkboxGroup">
              <label>
                <input
                  type="checkbox"
                  name="showHomeAirfieldOnHome"
                  defaultChecked={profile?.showHomeAirfieldOnHome ?? false}
                />
                {t("showHomeAirfield")}
              </label>

              <p className="muted">
                {t("showHomeAirfieldHint")}
              </p>
            </div>

            <div className="formGroup full">
              <label>{t("bio")}</label>
              <textarea
                name="bio"
                defaultValue={profile?.bio ?? ""}
              />
            </div>
          </div>

          <p>
            <button className="btn btnSuccess" type="submit">
              {t("save")}
            </button>
          </p>

          {noticeStatus ? <ProfileSaveNotice status={noticeStatus} /> : null}
        </form>
      </div>
      <div className="card" style={{marginBottom: 20}}>
        <div className="cardHead">
          <span className="cardTitle">{t("preferencesTitle")}</span>
        </div>

        <form className="cardBody" action={savePreferencesAction}>
          <input type="hidden" name="locale" value={locale} />

          <div className="formGrid">
            <div className="formGroup">
              <label>{t("themePreference")}</label>
              <select name="theme" defaultValue={preferences?.theme ?? "SYSTEM"}>
                <option value="SYSTEM">{t("themeSystem")}</option>
                <option value="LIGHT">{t("themeLight")}</option>
                <option value="DARK">{t("themeDark")}</option>
              </select>
            </div>
          </div>

          <p style={{marginTop: 20}}>
            <button className="btn btnSuccess" type="submit">
              {t("savePreferences")}
            </button>
          </p>
        </form>
      </div>
      <div className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("myFlights")}</span>
        </div>

        <div className="cardBody grid grid2">
          {flights.length === 0 ? (
            <p className="muted">{t("noFlights")}</p>
          ) : (
          flights.map((f: any) => {
            const isAdminDeleted = Boolean(f.deletedAt);
            const isModerationRestricted = f.moderationStatus !== "APPROVED";

            return (
              <div className="card featureTile flightManagementCard" key={f.id}>
                <div>
                  {isAdminDeleted ? (
                    <strong>{f.title}</strong>
                  ) : (
                    <Link href={`/flights/${f.id}`}>
                      <strong>{f.title}</strong>
                    </Link>
                  )}

                  <p className="muted">
                    {f.simulator} · {visibilityLabel(f.visibility, t)}
                  </p>

                  <p>
                    {Math.round(f.distanceKm)} km ·{" "}
                    {Math.round(f.olcPoints)} OLC
                  </p>

                  {isAdminDeleted || isModerationRestricted ? (
                    <div className="moderationNotice">
                      <strong>
                        {isAdminDeleted
                          ? t("flightRemovedByModeration")
                          : t("flightLockedByModeration")}
                      </strong>

                      {f.moderationNote ? (
                        <p className="muted">
                          {t("moderationNotePrefix")}: {f.moderationNote}
                        </p>
                      ) : null}

                      <p className="muted">
                        {isAdminDeleted
                          ? t("flightActionsLocked")
                          : t("flightVisibilityLockedButDeleteAllowed")}
                      </p>
                    </div>
                  ) : null}
                </div>

                {isAdminDeleted ? null : (
                  <FlightOwnerActions
                    flightId={f.id}
                    visibility={f.visibility}
                    canChangeVisibility={!isModerationRestricted}
                    canDelete={true}
                  />
                )}
              </div>
            );
          })
          )}
        </div>
      </div>
    </main>
  );
}
