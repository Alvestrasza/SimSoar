import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {redirect} from "next/navigation";

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
      <main className="wrap" style={{maxWidth: 820}}>
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

        <div className="cardBody">
          <p className="muted">{t("roleNotice")}</p>
        </div>

        <div className="tableWrap">
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
                      <span className="rolePill">
                        {formatRoles(user.roles)}
                      </span>
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
      </section>
    </main>
  );
}
