import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminAuditPageProps = {
  params: Promise<{locale: string}>;
};

function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(value);
}

function formatMetadata(metadata: unknown) {
  if (!metadata) return null;

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export default async function AdminAuditPage({params}: AdminAuditPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "AdminAudit"});

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

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100
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

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t("createdAt")}</th>
                <th>{t("actor")}</th>
                <th>{t("action")}</th>
                <th>{t("target")}</th>
                <th>{t("summary")}</th>
                <th>{t("metadata")}</th>
              </tr>
            </thead>

            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="emptyTable">
                    {t("noEntries")}
                  </td>
                </tr>
              ) : (
                auditLogs.map((entry) => {
                  const metadataText = formatMetadata(entry.metadata);

                  return (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt, locale)}</td>

                      <td>
                        {entry.actorEmail ?? t("system")}
                        {entry.actorUserId ? (
                          <>
                            <br />
                            <span className="muted">{entry.actorUserId}</span>
                          </>
                        ) : null}
                      </td>

                      <td>
                        <strong>{entry.action}</strong>
                      </td>

                      <td>
                        {entry.targetType}
                        {entry.targetId ? (
                          <>
                            <br />
                            <span className="muted">{entry.targetId}</span>
                          </>
                        ) : null}
                      </td>

                      <td>{entry.summary}</td>

                      <td>
                        {metadataText ? (
                          <details>
                            <summary>{t("showMetadata")}</summary>
                            <pre className="auditMetadata">{metadataText}</pre>
                          </details>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
