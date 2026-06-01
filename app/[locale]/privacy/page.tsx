import {setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type LegalPageProps = {
  params: Promise<{locale: string}>;
};

const COPY = {
  de: {
    title: "Datenschutzerklärung",
    subtitle: "Informationen zur Verarbeitung personenbezogener Daten in SimSoar",
    intro:
      "Diese Datenschutzerklärung beschreibt, welche personenbezogenen Daten bei der Nutzung von SimSoar verarbeitet werden. Die Plattform befindet sich aktuell in aktiver Entwicklung. Vor einem öffentlichen Produktivbetrieb muss diese Erklärung rechtlich geprüft und an die tatsächliche Infrastruktur angepasst werden.",
    controllerTitle: "1. Verantwortlicher",
    controllerText:
      "SimSoar Project Team",
    dataTitle: "2. Verarbeitete Daten",
    dataItems: [
      "Benutzerkonto-Daten, zum Beispiel Benutzerkennung, Benutzername, Anzeigename und E-Mail-Adresse",
      "Profilinformationen innerhalb von SimSoar, zum Beispiel Callsign, Heimatflugplatz, bevorzugter Simulator, bevorzugtes Flugzeug, Land und Profilbeschreibung",
      "hochgeladene IGC-Dateien und daraus berechnete Flugdaten, zum Beispiel Strecke, Höhe, Geschwindigkeit, Thermikdaten, Flugzeit und Trackpunkte",
      "technische Betriebsdaten, zum Beispiel Server-Logs, Zeitstempel, IP-Adresse, Browserdaten und Fehlerprotokolle",
      "sicherheitsrelevante Ereignisse, zum Beispiel Login-Status, Profiländerungen, Uploads, Moderationsaktionen und spätere Admin-Aktionen"
    ],
    purposeTitle: "3. Zwecke der Verarbeitung",
    purposeItems: [
      "Bereitstellung der SimSoar-Plattform",
      "Authentifizierung und Benutzerverwaltung über Keycloak",
      "Speicherung und Analyse virtueller Segelflüge",
      "Anzeige öffentlicher Bestenlisten und Flugdetails",
      "Betrieb, Sicherheit, Fehleranalyse und Missbrauchsprävention",
      "Moderation von öffentlichen Inhalten und Schutz der Plattformintegrität"
    ],
    legalBasisTitle: "4. Rechtsgrundlagen",
    legalBasisText:
      "Die Verarbeitung erfolgt je nach Funktion auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO zur Bereitstellung der Plattform, Art. 6 Abs. 1 lit. f DSGVO aufgrund berechtigter Interessen am sicheren und stabilen Betrieb sowie gegebenenfalls Art. 6 Abs. 1 lit. a DSGVO, wenn für optionale Funktionen eine Einwilligung erforderlich wird.",
    keycloakTitle: "5. Authentifizierung",
    keycloakText:
      "SimSoar nutzt OpenID Connect zur Anmeldung. Die eigentliche Benutzeridentität, Passwortregeln, MFA-Einstellungen und zentrale Rollenverwaltung werden im Identitätsdienst verwaltet. SimSoar verarbeitet nur die für Anmeldung, Rollenprüfung und Benutzerzuordnung notwendigen Token-Informationen.",
    uploadsTitle: "6. IGC-Uploads und öffentliche Flugdaten",
    uploadsText:
      "Hochgeladene IGC-Dateien können personenbezogene oder personenbeziehbare Daten enthalten, insbesondere wenn Callsigns, Namen, Kennzeichen oder Positionsdaten enthalten sind. Öffentliche Flüge können für andere Benutzer sichtbar sein. Private oder nicht gelistete Flüge sollen nur entsprechend ihrer Sichtbarkeit verarbeitet und angezeigt werden.",
    logsTitle: "7. Server-Logs und Sicherheit",
    logsText:
      "Beim Betrieb der Plattform können technische Logdaten verarbeitet werden. Dazu gehören insbesondere IP-Adressen, Zeitstempel, angefragte URLs, Statuscodes, Fehlermeldungen und sicherheitsrelevante Ereignisse. Diese Daten dienen dem sicheren Betrieb, der Fehleranalyse und der Abwehr von Missbrauch.",
    recipientsTitle: "8. Empfänger und Infrastruktur",
    recipientsText:
      "Die Anwendung ist für selbst gehostete Infrastruktur vorgesehen. Je nach Betriebsmodell können Webserver, Datenbankserver, Identitätsdienste, Reverse Proxy, Loadbalancer, Firewall, E-Mail-Systeme und Speicherkomponenten beteiligt sein.",
    retentionTitle: "9. Speicherdauer",
    retentionText:
      "Personenbezogene Daten werden nur so lange gespeichert, wie sie für die genannten Zwecke erforderlich sind. Benutzerprofile und Flugdaten bleiben grundsätzlich bestehen, solange das Benutzerkonto aktiv ist oder der Benutzer keine Löschung verlangt. Technische Logs sollen regelmäßig rotiert und nach einem angemessenen Zeitraum gelöscht werden.",
    rightsTitle: "10. Rechte betroffener Personen",
    rightsItems: [
      "Auskunft über die gespeicherten personenbezogenen Daten",
      "Berichtigung unrichtiger Daten",
      "Löschung personenbezogener Daten",
      "Einschränkung der Verarbeitung",
      "Datenübertragbarkeit",
      "Widerspruch gegen bestimmte Verarbeitungen",
      "Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft",
      "Beschwerde bei einer zuständigen Datenschutzaufsichtsbehörde"
    ],
    cookiesTitle: "11. Cookies und lokale Speicherung",
    cookiesText:
      "SimSoar kann technisch notwendige Cookies oder lokale Speichermechanismen verwenden, insbesondere für Anmeldung, Sitzung, Spracheinstellung, Sicherheitsfunktionen und Benutzereinstellungen. Nicht notwendige Tracking- oder Marketing-Cookies sind nicht vorgesehen.",
    automatedTitle: "12. Automatisierte Entscheidungen",
    automatedText:
      "Eine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO findet derzeit nicht statt. Automatische Flugauswertungen, Scoring- oder Thermikanalysen dienen der technischen Darstellung von Flugdaten und entfalten keine rechtliche Wirkung gegenüber Benutzern.",
    contactTitle: "13. Datenschutzkontakt",
    contactText:
      "Anfragen zum Datenschutz können an die im Impressum genannte Kontaktadresse gerichtet werden.",
    reviewNotice:
      " "
  },
  en: {
    title: "Privacy Policy",
    subtitle: "Information on the processing of personal data in SimSoar",
    intro:
      "This privacy policy describes which personal data is processed when using SimSoar. The platform is currently under active development. Before public production use, this policy must be legally reviewed and adapted to the actual infrastructure.",
    controllerTitle: "1. Controller",
    controllerText:
      "SimSoar Project Team",
    dataTitle: "2. Processed data",
    dataItems: [
      "user account data, for example user ID, username, display name and email address",
      "profile information within SimSoar, for example callsign, home airfield, preferred simulator, preferred aircraft, country and profile description",
      "uploaded IGC files and calculated flight data, for example distance, altitude, speed, thermal data, flight time and track points",
      "technical operational data, for example server logs, timestamps, IP address, browser data and error logs",
      "security-relevant events, for example login status, profile changes, uploads, moderation actions and future admin actions"
    ],
    purposeTitle: "3. Purposes of processing",
    purposeItems: [
      "providing the SimSoar platform",
      "authentication and user management through Keycloak",
      "storing and analyzing virtual gliding flights",
      "displaying public leaderboards and flight details",
      "operation, security, troubleshooting and abuse prevention",
      "moderation of public content and protection of platform integrity"
    ],
    legalBasisTitle: "4. Legal bases",
    legalBasisText:
      "Depending on the feature, processing is based on Art. 6(1)(b) GDPR for providing the platform, Art. 6(1)(f) GDPR due to legitimate interests in secure and stable operation, and, where required for optional features, Art. 6(1)(a) GDPR based on consent.",
    keycloakTitle: "5. Authentication ",
    keycloakText:
      "SimSoar uses OpenID Connect for sign-in. The actual user identity, password policies, MFA settings and central role management are handled by the identity service. SimSoar only processes token information required for sign-in, role checks and user mapping.",
    uploadsTitle: "6. IGC uploads and public flight data",
    uploadsText:
      "Uploaded IGC files may contain personal or person-related data, especially if callsigns, names, registrations or position data are included. Public flights may be visible to other users. Private or unlisted flights should only be processed and displayed according to their visibility setting.",
    logsTitle: "7. Server logs and security",
    logsText:
      "During platform operation, technical log data may be processed. This includes IP addresses, timestamps, requested URLs, status codes, error messages and security-relevant events. These data are used for secure operation, troubleshooting and abuse prevention.",
    recipientsTitle: "8. Recipients and infrastructure",
    recipientsText:
      "The application is intended for self-hosted infrastructure. Depending on the operating model, web servers, database servers, Keycloak, reverse proxy, load balancer, firewall, email systems and storage components may be involved.",
    retentionTitle: "9. Retention period",
    retentionText:
      "Personal data are stored only as long as necessary for the stated purposes. User profiles and flight data generally remain stored while the user account is active or until deletion is requested. Technical logs should be rotated regularly and deleted after an appropriate period.",
    rightsTitle: "10. Rights of data subjects",
    rightsItems: [
      "access to stored personal data",
      "rectification of inaccurate data",
      "erasure of personal data",
      "restriction of processing",
      "data portability",
      "objection to certain processing operations",
      "withdrawal of consent with effect for the future",
      "complaint to a competent data protection supervisory authority"
    ],
    cookiesTitle: "11. Cookies and local storage",
    cookiesText:
      "SimSoar may use technically necessary cookies or local storage mechanisms, especially for sign-in, session handling, language settings, security functions and future user preferences such as dark mode. Non-essential tracking or marketing cookies are not planned.",
    automatedTitle: "12. Automated decision-making",
    automatedText:
      "Automated decision-making within the meaning of Art. 22 GDPR currently does not take place. Automatic flight evaluation, scoring or thermal analysis is used for the technical presentation of flight data and has no legal effect on users.",
    contactTitle: "13. Privacy contact",
    contactText:
      "Privacy-related requests can be sent to the contact address listed in the legal notice.",
    reviewNotice:
      " "
  }
} as const;

function getCopy(locale: string) {
  return locale === "en" ? COPY.en : COPY.de;
}

export default async function PrivacyPage({params}: LegalPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = getCopy(locale);

  return (
    <main className="wrap" style={{maxWidth: 960}}>
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
          <p>{t.intro}</p>

          <h2>{t.controllerTitle}</h2>
          <p>
            {t.controllerText.split("\n").map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>

          <h2>{t.dataTitle}</h2>
          <ul>
            {t.dataItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.purposeTitle}</h2>
          <ul>
            {t.purposeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.legalBasisTitle}</h2>
          <p>{t.legalBasisText}</p>

          <h2>{t.keycloakTitle}</h2>
          <p>{t.keycloakText}</p>

          <h2>{t.uploadsTitle}</h2>
          <p>{t.uploadsText}</p>

          <h2>{t.logsTitle}</h2>
          <p>{t.logsText}</p>

          <h2>{t.recipientsTitle}</h2>
          <p>{t.recipientsText}</p>

          <h2>{t.retentionTitle}</h2>
          <p>{t.retentionText}</p>

          <h2>{t.rightsTitle}</h2>
          <ul>
            {t.rightsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2>{t.cookiesTitle}</h2>
          <p>{t.cookiesText}</p>

          <h2>{t.automatedTitle}</h2>
          <p>{t.automatedText}</p>

          <h2>{t.contactTitle}</h2>
          <p>{t.contactText}</p>

          <p className="muted" style={{marginTop: 28}}>
            {t.reviewNotice}
          </p>
        </div>
      </section>
    </main>
  );
}
