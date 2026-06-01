import {setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{locale: string}>;
};

const COPY = {
  de: {
    title: "Impressum",
    subtitle: "Anbieterkennzeichnung für SimSoar",
    legalBasis: "Angaben gemäß § 5 DDG",
    operatorTitle: "Betreiber",
    operatorName: "SimSoar Project Team",
    addressTitle: "Anschrift",
    addressLines: [
      " ",
      " ",
      " "
    ],
    contactTitle: "Kontakt",
    emailLabel: "E-Mail",
    emailValue: "simsoar@alvestrasza.com",
    githubLabel: "GitHub",
    githubValue: "https://github.com/Alvestrasza/simsoar",
    responsibleTitle: "Verantwortlich für den Inhalt",
    responsibleText:
      "SimSoar Project Team, Anschrift wie oben.",
    projectTitle: "Projektbeschreibung",
    projectText:
      "SimSoar ist eine Plattform für virtuelle Segelflugpiloten. Benutzer können IGC-Flugdateien hochladen, analysieren und mit anderen Flügen vergleichen. Die Plattform befindet sich aktuell in aktiver Entwicklung.",
    userContentTitle: "Benutzerinhalte",
    userContentText:
      "Benutzer können eigene Flugdaten, Callsigns, Profilinformationen und Kommentare hinterlegen. Für rechtswidrige, fehlerhafte oder missbräuchliche Inhalte kann eine Meldung über die oben genannte Kontaktadresse erfolgen.",
    copyrightTitle: "Urheberrecht und Marken",
    copyrightText:
      "Die Inhalte, Quelltexte, Texte, Gestaltungselemente und Projektbezeichnungen dieser Website unterliegen, soweit anwendbar, dem Urheberrecht. Marken und Produktnamen Dritter, insbesondere Simulatornamen, bleiben Eigentum der jeweiligen Rechteinhaber.",
    liabilityTitle: "Haftungshinweis",
    liabilityText:
      "Die Inhalte dieser Website werden mit größter Sorgfalt erstellt. Für Vollständigkeit, Aktualität und Richtigkeit kann jedoch keine Gewähr übernommen werden. Externe Links führen zu Inhalten Dritter, auf die kein dauerhafter Einfluss besteht.",
    reviewNotice:
      " "
  },
  en: {
    title: "Legal Notice",
    subtitle: "Provider identification for SimSoar",
    legalBasis: "Information according to Section 5 German Digital Services Act (DDG)",
    operatorTitle: "Operator",
    operatorName: "SimSoar Project Team",
    addressTitle: "Postal address",
    addressLines: [
      " ",
      " ",
      " "
    ],
    contactTitle: "Contact",
    emailLabel: "Email",
    emailValue: "simsoar@alvestrasza.com",
    githubLabel: "GitHub",
    githubValue: "https://github.com/Alvestrasza/simsoar",
    responsibleTitle: "Responsible for content",
    responsibleText:
      "SimSoar Project Team, address as stated above.",
    projectTitle: "Project description",
    projectText:
      "SimSoar is a platform for virtual glider pilots. Users can upload, analyze and compare IGC flight files. The platform is currently under active development.",
    userContentTitle: "User-generated content",
    userContentText:
      "Users may store their own flight data, callsigns, profile information and comments. Illegal, incorrect or abusive content can be reported via the contact address listed above.",
    copyrightTitle: "Copyright and trademarks",
    copyrightText:
      "The contents, source code, texts, design elements and project names of this website are protected by copyright where applicable. Third-party trademarks and product names, including simulator names, remain the property of their respective rights holders.",
    liabilityTitle: "Liability notice",
    liabilityText:
      "The content of this website is prepared with care. However, no guarantee can be given for completeness, accuracy or timeliness. External links lead to third-party content over which there is no permanent control.",
    reviewNotice:
      " "
  }
} as const;

function getCopy(locale: string) {
  return locale === "en" ? COPY.en : COPY.de;
}

export default async function ImprintPage({params}: LegalPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = getCopy(locale);

  return (
    <main className="wrap" style={{maxWidth: 920}}>
      <section className="card">
        <div className="cardHead">
          <div>
            <span className="cardTitle">{t.title}</span>
            <p className="muted" style={{margin: "6px 0 0"}}>
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="cardBody lineHeight">
          <h2>{t.legalBasis}</h2>

          <h3>{t.operatorTitle}</h3>
          <p>{t.operatorName}</p>

          <h3>{t.addressTitle}</h3>
          <p>
            {t.addressLines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>

          <h3>{t.contactTitle}</h3>
          <p>
            {t.emailLabel}: {t.emailValue}
            <br />
            {t.githubLabel}:{" "}
            <a href={t.githubValue} target="_blank" rel="noreferrer">
              {t.githubValue}
            </a>
          </p>

          <h3>{t.responsibleTitle}</h3>
          <p>{t.responsibleText}</p>

          <h3>{t.projectTitle}</h3>
          <p>{t.projectText}</p>

          <h3>{t.userContentTitle}</h3>
          <p>{t.userContentText}</p>

          <h3>{t.copyrightTitle}</h3>
          <p>{t.copyrightText}</p>

          <h3>{t.liabilityTitle}</h3>
          <p>{t.liabilityText}</p>

          <p className="muted" style={{marginTop: 28}}>
            {t.reviewNotice}
          </p>
        </div>
      </section>
    </main>
  );
}
