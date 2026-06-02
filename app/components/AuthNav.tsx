import {Link} from "@/i18n/navigation";
import {auth} from "@/auth";
import {hasRole} from "@/lib/rbac";
import {signInWithKeycloak, signOutWithKeycloak} from "@/app/auth-actions";
import {getTranslations} from "next-intl/server";

type AuthNavProps = {
  locale: string;
};

export async function AuthNav({locale}: AuthNavProps) {
  const session = await auth();
  const nav = await getTranslations({locale, namespace: "Nav"});

  if (!session?.user) {
    return (
      <form action={signInWithKeycloak}>
        <input type="hidden" name="locale" value={locale} />
        <button className="btn btnPrimary" type="submit">
          {nav("login")}
        </button>
      </form>
    );
  }

  const canUseAdmin = hasRole(session.user.roles, "MODERATOR");

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
