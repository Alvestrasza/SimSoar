import {Link} from "@/i18n/navigation";
import {signInWithKeycloak, signOutWithKeycloak} from "@/app/auth-actions";
import {getTranslations} from "next-intl/server";

type AuthNavProps = {
  locale: string;
  isAuthenticated: boolean;
  canUseAdmin: boolean;
};

export async function AuthNav({locale, isAuthenticated, canUseAdmin}: AuthNavProps) {
  const nav = await getTranslations({locale, namespace: "Nav"});

  if (!isAuthenticated) {
    return (
      <form action={signInWithKeycloak}>
        <input type="hidden" name="locale" value={locale} />
        <button className="btn btnPrimary" type="submit">
          {nav("login")}
        </button>
      </form>
    );
  }

  return (
    <>
      {canUseAdmin ? (
        <Link className="btn btnSecondary" href="/admin">
          {nav("admin")}
        </Link>
      ) : null}

      <Link className="btn btnSecondary" href="/profile">
        {nav("myProfile")}
      </Link>

      <form action={signOutWithKeycloak}>
        <input type="hidden" name="locale" value={locale} />
        <button className="btn btnSecondary" type="submit">
          {nav("logout")}
        </button>
      </form>
    </>
  );
}
