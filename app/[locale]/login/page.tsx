import {signIn} from "@/auth";

type LoginPageProps = {
  params: Promise<{locale: string}>;
};

export default async function LoginPage({params}: LoginPageProps) {
  const {locale} = await params;

  async function loginAction() {
    "use server";
    await signIn("keycloak", {redirectTo: `/${locale}`});
  }

  return (
    <main className="wrap" style={{maxWidth: 560}}>
      <div className="card">
        <div className="cardHead">
          <span className="cardTitle">🔐 Anmeldung</span>
        </div>
        <div className="cardBody">
          <p className="muted">
            SimSoar nutzt Keycloak/OIDC. Benutzerverwaltung, MFA und Passwortregeln bleiben damit zentral.
          </p>

          <form action={loginAction}>
            <button className="btn btnPrimary" type="submit">
              Mit Keycloak anmelden
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}