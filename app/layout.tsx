import type { Metadata } from "next";
import Link from "next/link";
import { SITE_COPYRIGHT_HOLDER, SITE_VERSION } from "@/lib/site";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimSoar – Virtual Gliding Community",
  description: "Multi-user virtual gliding community for MSFS, Condor and X-Plane IGC flights."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
            <Link className="btn btnSecondary" href="/profile">Mein Profil</Link>
            <Link className="btn btnPrimary" href="/login">Anmelden</Link>
          </div>
        </nav>
        {children}
        <footer className="siteFooter">
          <span>© {new Date().getFullYear()} {SITE_COPYRIGHT_HOLDER}. Alle Rechte vorbehalten.</span>
          <span>SimSoar v{SITE_VERSION}</span>
        </footer>
      </body>
    </html>
  );
}
