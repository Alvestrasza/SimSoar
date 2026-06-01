import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{locale: string}>;
};

export default async function ImprintPage({params}: LegalPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "LegalImprint"});
  const addressLines = t.raw("addressLines") as string[];

  return (
    <main className="wrap" style={{maxWidth: 920}}>
      <section className="card">
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t("title")}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="cardBody lineHeight">
          <h2>{t("legalBasis")}</h2>

          <h3>{t("operatorTitle")}</h3>
          <p>{t("operatorName")}</p>

          <h3>{t("addressTitle")}</h3>
          <p>
            {addressLines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>

          <h3>{t("contactTitle")}</h3>
          <p>
            {t("emailLabel")}: {t("emailValue")}
            <br />
            {t("githubLabel")}:{" "}
            <a href={t("githubValue")} target="_blank" rel="noreferrer">
              {t("githubValue")}
            </a>
          </p>

          <h3>{t("responsibleTitle")}</h3>
          <p>{t("responsibleText")}</p>

          <h3>{t("projectTitle")}</h3>
          <p>{t("projectText")}</p>

          <h3>{t("userContentTitle")}</h3>
          <p>{t("userContentText")}</p>

          <h3>{t("copyrightTitle")}</h3>
          <p>{t("copyrightText")}</p>

          <h3>{t("liabilityTitle")}</h3>
          <p>{t("liabilityText")}</p>

          <p className="muted" style={{marginTop: 28}}>
            {t("reviewNotice")}
          </p>
        </div>
      </section>
    </main>
  );
}
