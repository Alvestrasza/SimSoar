import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <div className="card">
        <div className="cardHead"><span className="cardTitle">🔐 Anmeldung</span></div>
        <div className="cardBody">
          <p className="muted">
            SimSoar nutzt Keycloak/OIDC. Benutzerverwaltung, MFA und Passwortregeln bleiben damit zentral.
          </p>
          <form action={async () => { "use server"; await signIn("keycloak", { redirectTo: "/" }); }}>
            <button className="btn btnPrimary" type="submit">Mit Keycloak anmelden</button>
          </form>
        </div>
      </div>
    </main>
  );
}
