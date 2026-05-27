import { auth } from "@/auth";
import { signInWithKeycloak, signOutWithKeycloak } from "@/app/auth-actions";

export async function AuthNav() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form action={signInWithKeycloak}>
        <button className="btn btnPrimary" type="submit">
          Anmelden
        </button>
      </form>
    );
  }

  return (
    <>
      <a className="btn btnSecondary" href="/profile">
        Mein Profil
      </a>

      <form action={signOutWithKeycloak}>
        <button className="btn btnSecondary" type="submit">
          Abmelden
        </button>
      </form>
    </>
  );
}