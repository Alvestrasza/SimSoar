import type {Metadata} from "next";
import {Suspense} from "react";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getMessages, getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "@/i18n/routing";
import {Link} from "@/i18n/navigation";
import {SITE_COPYRIGHT_HOLDER, SITE_VERSION} from "@/lib/site";
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
              © {new Date().getFullYear()} {SITE_COPYRIGHT_HOLDER}. {footer("rights")}
            </span>
            <span>SimSoar v{SITE_VERSION}</span>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}