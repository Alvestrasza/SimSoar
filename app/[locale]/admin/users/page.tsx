import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole, SIMSOAR_ROLE_ORDER} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {redirect} from "next/navigation";
import {updateUserRoles} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminUsersPageProps = {
  params: Promise<{locale: string}>;
};

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatRoles(roles: string[]) {
  return roles.length > 0 ? roles.join(", ") : "USER";
}

function canEditRole(role: string, actorIsOwner: boolean) {
  if (role === "USER") return false;
  if (role === "ADMIN" || role === "OWNER") return actorIsOwner;
  return true;
}

export default async function AdminUsersPage({params}: AdminUsersPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "AdminUsers"});

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  if (!hasRole(session.user.roles, "ADMIN")) {
    return (
      <main className="wrap adminWrap">
        <section className="card">
          <div className="cardHead">
            <div>
              <span className="cardTitle">{t("accessDeniedTitle")}</span>
              <p className="muted" style={{margin: "6px 0 0"}}>
                {t("accessDeniedSubtitle")}
              </p>
            </div>
          </div>

          <div className="cardBody lineHeight">
            <p>{t("accessDeniedText")}</p>

            <p style={{marginTop: 22}}>
              <Link className="btn btnSecondary" href="/admin">
                {t("backToAdmin")}
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const actorIsOwner = hasRole(session.user.roles, "OWNER");

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          callsign: true,
          homeAirfield: true,
          favoriteSim: true,
          favoriteGlider: true,
          country: true
        }
      },
      _count: {
        select: {
          flights: true
        }
      }
    }
  });

  return (
    <main className="wrap adminWrap">
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

        <div className="cardBody">
          <p className="muted">{t("roleNotice")}</p>
        </div>

        <div className="tableWrap adminUsersDesktopTable">
          <table>
            <thead>
              <tr>
                <th>{t("user")}</th>
                <th>{t("roles")}</th>
                <th>{t("pilotProfile")}</th>
                <th>{t("homeAirfield")}</th>
                <th>{t("favoriteSim")}</th>
                <th>{t("flights")}</th>
                <th>{t("createdAt")}</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="emptyTable">
                    {t("noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name ?? t("unknownUser")}</strong>
                      <br />
                      <span className="muted">{user.email ?? "–"}</span>
                      <br />
                      <span className="muted">{user.id}</span>
                    </td>

                    <td>
                      <form action={updateUserRoles}>
                        <input type="hidden" name="userId" value={user.id} />

                        <div style={{display: "grid", gap: 6}}>
                          {SIMSOAR_ROLE_ORDER.map((role) => {
                            const editable = canEditRole(role, actorIsOwner);

                            return (
                              <label
                                className="adminRoleCheckbox"
                                key={role}
                                style={{
                                  opacity: editable || role === "USER" ? 1 : 0.65
                                }}
                              >
                                <input
                                  type="checkbox"
                                  name="roles"
                                  value={role}
                                  defaultChecked={role === "USER" || user.roles.includes(role)}
                                  disabled={!editable}
                                />
                                <span>{role}</span>
                              </label>
                            );
                          })}
                        </div>

                        <p style={{marginTop: 10}}>
                          <button className="btn btnSecondary btnSm" type="submit">
                            {t("saveRoles")}
                          </button>
                        </p>

                        {!actorIsOwner ? (
                          <p className="muted" style={{fontSize: 12, marginTop: 6}}>
                            {t("adminOwnerRoleHint")}
                          </p>
                        ) : null}
                      </form>
                    </td>

                    <td>
                      {user.profile?.callsign ? (
                        <>
                          <strong>{user.profile.callsign}</strong>
                          {user.profile.favoriteGlider ? (
                            <>
                              <br />
                              <span className="muted">
                                {user.profile.favoriteGlider}
                              </span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="muted">{t("noPilotProfile")}</span>
                      )}
                    </td>

                    <td>{user.profile?.homeAirfield ?? "–"}</td>

                    <td>{user.profile?.favoriteSim ?? "–"}</td>

                    <td>{user._count.flights}</td>

                    <td>{formatDate(user.createdAt, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="adminUsersMobileCards">
          {users.length === 0 ? (
            <p className="muted emptyInline">{t("noUsers")}</p>
          ) : (
            users.map((user) => (
              <article className="adminUserMobileCard" key={user.id}>
                <div className="adminUserMobileHeader">
                  <div className="adminUserMobileIdentity">
                    <strong>{user.name ?? t("unknownUser")}</strong>

                    <span className="muted">{user.email ?? "–"}</span>

                    <span className="muted adminUserMobileId">
                      {user.id}
                    </span>
                  </div>

                  <div className="adminUserMobileFlightCount">
                    <span>{t("flights")}</span>
                    <strong>{user._count.flights}</strong>
                  </div>
                </div>

                <div className="adminUserMobileSection">
                  <span className="adminUserMobileLabel">{t("roles")}</span>

                  <form className="adminUserRoleForm" action={updateUserRoles}>
                    <input type="hidden" name="userId" value={user.id} />

                    <div className="adminUserRoleGrid">
                      {SIMSOAR_ROLE_ORDER.map((role) => {
                        const editable = canEditRole(role, actorIsOwner);

                        return (
                          <label
                            className="adminRoleCheckbox"
                            key={role}
                            style={{
                              opacity: editable || role === "USER" ? 1 : 0.65
                            }}
                          >
                            <input
                              type="checkbox"
                              name="roles"
                              value={role}
                              defaultChecked={role === "USER" || user.roles.includes(role)}
                              disabled={!editable}
                            />
                            <span>{role}</span>
                          </label>
                        );
                      })}
                    </div>

                    <button className="btn btnSecondary btnSmall" type="submit">
                      {t("saveRoles")}
                    </button>

                    {!actorIsOwner ? (
                      <p className="muted adminUserMobileHint">
                        {t("adminOwnerRoleHint")}
                      </p>
                    ) : null}
                  </form>
                </div>

                <div className="adminUserMobileGrid">
                  <div>
                    <span>{t("pilotProfile")}</span>
                    <strong>
                      {user.profile?.callsign ?? t("noPilotProfile")}
                    </strong>
                  </div>

                  <div>
                    <span>{t("homeAirfield")}</span>
                    <strong>{user.profile?.homeAirfield ?? "–"}</strong>
                  </div>

                  <div>
                    <span>{t("favoriteSim")}</span>
                    <strong>{user.profile?.favoriteSim ?? "–"}</strong>
                  </div>

                  <div>
                    <span>{t("createdAt")}</span>
                    <strong>{formatDate(user.createdAt, locale)}</strong>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>        
      </section>
    </main>
  );
}
