import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import UnblockIgcUploadButton from "@/app/components/UnblockIgcUploadButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminIgcBlocksPageProps = {
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

export default async function AdminIgcBlocksPage({
  params,
  searchParams
}: AdminIgcBlocksPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "AdminIgcBlocks"});

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  if (!hasRole(session.user.roles, "ADMIN")) {
    notFound();
  }

  const queryParams = searchParams ? await searchParams : {};
  const updatedParam = Array.isArray(queryParams.updated)
    ? queryParams.updated[0]
    : queryParams.updated;

  const blocks = await prisma.igcUploadBlock.findMany({
    orderBy: {
      blockedAt: "desc"
    },
    take: 100,
    select: {
      id: true,
      igcSha256: true,
      originalFlightId: true,
      originalTitle: true,
      originalPilotCallsign: true,
      reason: true,
      blockedAt: true
    }
  });

  return (
    <main className="wrap adminFlightsWrap">
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
          {blocks.length === 0 ? (
            <p className="muted">{t("noBlockedHashes")}</p>
          ) : (
            <div className="moderationCardGrid">
              {blocks.map((block) => (
                <article className="moderationCard" key={block.id}>
                  <div className="moderationCardMain">
                    <div className="moderationCardTop">
                      <div>
                        <strong className="moderationFlightTitle">
                          {block.originalTitle ?? t("unknownFlight")}
                        </strong>

                        <p className="muted moderationSubLine">
                          {block.originalPilotCallsign ?? "–"} · {block.reason}
                        </p>
                      </div>

                      <span className="moderationStatusBadge deleted">
                        {t("blocked")}
                      </span>
                    </div>

                    <div className="moderationMetaGrid">
                      <div>
                        <span>{t("hash")}</span>
                        <strong className="hashText">{block.igcSha256}</strong>
                      </div>

                      <div>
                        <span>{t("originalFlightId")}</span>
                        <strong>{block.originalFlightId ?? "–"}</strong>
                      </div>

                      <div>
                        <span>{t("blockedAt")}</span>
                        <strong>{formatDate(block.blockedAt, locale)}</strong>
                      </div>

                      <div>
                        <span>{t("reason")}</span>
                        <strong>{block.reason}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="moderationCardActions">
                    <UnblockIgcUploadButton
                      blockId={block.id}
                      igcSha256={block.igcSha256}
                      returnTo={`/${locale}/admin/igc-blocks`}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
