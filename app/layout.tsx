import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimSoar – Virtual Gliding Community",
  description: "Multi-user virtual gliding community for MSFS, Condor and X-Plane IGC flights."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="de">
      <body>
        <nav className="nav">
          <Link className="logo" href="/">
            <span className="logoMark">🛩</span>
            <span>SimSoar</span>
          </Link>
          <div className="navLinks">
            <Link href="/">Home</Link>
            <Link href="/flights">Flüge</Link>
            <Link href="/upload">Upload</Link>
            <Link href="/pilots">Piloten</Link>
            <Link href="/profile">Profil</Link>
          </div>
          <div className="navRight">
            {session?.user ? (
              <>
                <Link className="btn btnSecondary" href="/profile">{session.user.name ?? "Mein Profil"}</Link>
                <form action={async () => { "use server"; await signOut(); }}>
                  <button className="btn btnSecondary" type="submit">Abmelden</button>
                </form>
              </>
            ) : (
              <form action={async () => { "use server"; await signIn("keycloak"); }}>
                <button className="btn btnPrimary" type="submit">Anmelden</button>
              </form>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
