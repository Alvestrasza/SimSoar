import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound, redirect} from "next/navigation";

export const dynamic = "force-dynamic";

type UploadResultsPageProps = {
  params: Promise<{locale: string; batchId: string}>;
};

export default async function UploadResultsPage({params}: UploadResultsPageProps) {
  const {locale, batchId} = await params;
  setRequestLocale(locale);
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const [t, batch] = await Promise.all([
    getTranslations({locale, namespace: "Upload"}),
    prisma.uploadBatch.findFirst({
      where: {id: batchId, userId: session.user.id},
      include: {items: {orderBy: {createdAt: "asc"}}}
    })
  ]);

  if (!batch) {
    notFound();
  }

  const imported = batch.items.filter((item) => item.status === "IMPORTED");
  const failed = batch.items.filter((item) => item.status === "FAILED");

  return (
    <main className="wrap" style={{maxWidth: 860}}>
      <div className="card">
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t("resultTitle")}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t("resultSummary", {successful: imported.length, failed: failed.length})}
            </p>
          </div>
          <Link className="btn btnPrimary" href="/upload">{t("uploadMore")}</Link>
        </div>

        <div className="cardBody uploadResultGroups">
          <section>
            <h2>{t("successfulImports", {count: imported.length})}</h2>
            {imported.length === 0 ? <p className="muted">{t("noSuccessfulImports")}</p> : (
              <div className="uploadResultList">
                {imported.map((item) => (
                  <div className="uploadResultItem uploadResultSuccess" key={item.id}>
                    <span>✓ {item.originalFileName}</span>
                    {item.flightId ? <Link href={`/flights/${item.flightId}`}>{t("openFlight")}</Link> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2>{t("failedImports", {count: failed.length})}</h2>
            {failed.length === 0 ? <p className="muted">{t("noFailedImports")}</p> : (
              <div className="uploadResultList">
                {failed.map((item) => (
                  <div className="uploadResultItem uploadResultFailure" key={item.id}>
                    <span>✕ {item.originalFileName}</span>
                    <span className="muted">{t(`uploadError_${item.errorCode ?? "processing-failed"}`)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
