import type {Metadata, Viewport} from "next";
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
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import QuickThemeToggle from "@/app/components/QuickThemeToggle";
import {NotificationNav} from "@/app/components/NotificationNav";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#1f6feb"
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#0f172a"
    }
  ],
  colorScheme: "light dark"
};

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Metadata"});

  return {
    title: t("title"),
    description: t("description"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/icons/simsoar-icon.svg",
      apple: "/icons/simsoar-icon.svg"
    },
    appleWebApp: {
      capable: true,
      title: "SimSoar",
      statusBarStyle: "default"
    }
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

  let themePreference: "system" | "light" | "dark" = "system";

try {
  const session = await auth();

  if (session?.user?.id) {
    const preferences = await prisma.userPreference.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        theme: true
      }
    });

    if (preferences?.theme === "LIGHT") {
      themePreference = "light";
    }

    if (preferences?.theme === "DARK") {
      themePreference = "dark";
    }
  }
} catch (error) {
  console.error("SimSoar theme preference could not be loaded:", error);
}

  return (
    <html lang={locale} data-theme={themePreference} suppressHydrationWarning>
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
              <Link href="/clubs">{nav("clubs")}</Link>
              <Link href="/competitions">{nav("competitions")}</Link>
              <Link href="/leagues">{nav("leagues")}</Link>
              <Link href="/tasks">{nav("tasks")}</Link>
            </div>

            <div className="navRight">
              <Suspense fallback={null}>
                <NotificationNav locale={locale} />
              </Suspense>
              <QuickThemeToggle />
              <LocaleSwitcher />
              <Suspense fallback={null}>
                <AuthNav locale={locale} />
              </Suspense>
            </div>
          </nav>

          {children}

          <footer className="siteFooter">
            <span>
              {footer("copyright", {
                year: SITE_COPYRIGHT_YEAR,
                holder1: SITE_COPYRIGHT_HOLDER1,
                holder2: SITE_COPYRIGHT_HOLDER2
              })}
            </span>

            <span className="footerLinks">
              <Link href={SITE_LINKS.imprint}>{footer("imprint")}</Link>
              <Link href={SITE_LINKS.privacy}>{footer("privacy")}</Link>

              <a href={SITE_LINKS.github} target="_blank" rel="noreferrer">
                {footer("github")}
              </a>

              <a href={SITE_LINKS.issues} target="_blank" rel="noreferrer">
                {footer("issues")}
              </a>
            </span>

            <span>{footer("version", { version: SITE_VERSION })}</span>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
