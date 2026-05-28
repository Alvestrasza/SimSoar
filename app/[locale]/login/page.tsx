import {signIn} from "@/auth";
import {getTranslations, setRequestLocale} from "next-intl/server";

type LoginPageProps = {
  params: Promise<{locale: string}>;
};

export default async function LoginPage({params}: LoginPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Login"
  });

  async function loginAction() {
    "use server";
    await signIn("keycloak", {redirectTo: `/${locale}`});
  }

  return (
    <main className="wrap" style={{maxWidth: 560}}>
      <div className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("title")}</span>
        </div>

        <div className="cardBody">
          <p className="muted">
            {t("description")}
          </p>

          <form action={loginAction}>
            <button className="btn btnPrimary" type="submit">
              {t("button")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}