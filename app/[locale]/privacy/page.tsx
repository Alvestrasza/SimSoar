import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{locale: string}>;
};

export default async function PrivacyPage({params}: LegalPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "LegalPrivacy"});
  const controllerLines = t.raw("controllerLines") as string[];
  const dataItems = t.raw("dataItems") as string[];
  const purposeItems = t.raw("purposeItems") as string[];
  const rightsItems = t.raw("rightsItems") as string[];

  return (
    <main className="wrap" style={{maxWidth: 960}}>
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
          <p>{t("intro")}</p>

          <h2>{t("controllerTitle")}</h2>
          <p>
            {controllerLines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>

          <h2>{t("dataTitle")}</h2>
          <ul>
            {dataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t("purposeTitle")}</h2>
          <ul>
            {purposeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t("legalBasisTitle")}</h2>
          <p>{t("legalBasisText")}</p>

          <h2>{t("keycloakTitle")}</h2>
          <p>{t("keycloakText")}</p>

          <h2>{t("uploadsTitle")}</h2>
          <p>{t("uploadsText")}</p>

          <h2>{t("logsTitle")}</h2>
          <p>{t("logsText")}</p>

          <h2>{t("recipientsTitle")}</h2>
          <p>{t("recipientsText")}</p>

          <h2>{t("retentionTitle")}</h2>
          <p>{t("retentionText")}</p>

          <h2>{t("rightsTitle")}</h2>
          <ul>
            {rightsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t("cookiesTitle")}</h2>
          <p>{t("cookiesText")}</p>

          <h2>{t("automatedTitle")}</h2>
          <p>{t("automatedText")}</p>

          <h2>{t("contactTitle")}</h2>
          <p>{t("contactText")}</p>

          <p className="muted" style={{marginTop: 28}}>
            {t("reviewNotice")}
          </p>
        </div>
      </section>
    </main>
  );
}
