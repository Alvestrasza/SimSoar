import type {Metadata} from "next";
import {Suspense} from "react";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getMessages, getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {
  SITE_COPYRIGHT_HOLDER1,
  SITE_COPYRIGHT_HOLDER2,
  SITE_COPYRIGHT_YEAR,
  SITE_LINKS,
  SITE_VERSION
} from "@/lib/site";
import "leaflet/dist/leaflet.css";
import "../globals.css";
import {AuthNav} from "@/app/components/AuthNav";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Metadata"});

  return {
    title: t("title"),
    description: t("description")
  };
}

export default async function LocaleLayout({
  children,
  params
}: LocaleLayoutProps) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const nav = await getTranslations({locale, namespace: "Nav"});
  const footer = await getTranslations({locale, namespace: "Footer"});

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {process.env.NEXT_PUBLIC_SIMSOAR_ENV === "dev" ? (
            <div className="devBanner">
              DEV ENVIRONMENT – SimSoar Development
            </div>
          ) : null}

          <nav className="nav">
            <Link className="logo" href="/">
              <span className="logoMark">🛩</span>
              <span>SimSoar</span>
            </Link>

            <div className="navLinks">
              <Link href="/">{nav("home")}</Link>
              <Link href="/flights">{nav("flights")}</Link>
              <Link href="/upload">{nav("upload")}</Link>
              <Link href="/pilots">{nav("pilots")}</Link>
              <Link href="/profile">{nav("profile")}</Link>
            </div>

            <div className="navRight">
              <LocaleSwitcher />
              <Suspense fallback={null}>
                <AuthNav locale={locale} />
              </Suspense>
            </div>
          </nav>

          {children}

          <footer className="siteFooter">
            <span>
              {t("copyright", {
                year: SITE_COPYRIGHT_YEAR,
                holder1: SITE_COPYRIGHT_HOLDER1,
                holder2: SITE_COPYRIGHT_HOLDER2
              })}
            </span>

            <span className="footerLinks">
              <Link href={SITE_LINKS.imprint}>{t("imprint")}</Link>
              <Link href={SITE_LINKS.privacy}>{t("privacy")}</Link>

              <a href={SITE_LINKS.github} target="_blank" rel="noreferrer">
                {t("github")}
              </a>

              <a href={SITE_LINKS.issues} target="_blank" rel="noreferrer">
                {t("issues")}
              </a>
            </span>

            <span>{t("version", { version: SITE_VERSION })}</span>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
