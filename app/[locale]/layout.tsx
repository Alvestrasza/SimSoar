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
import {hasRole} from "@/lib/rbac";

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

  const [messages, nav, footer] = await Promise.all([
    getMessages(),
    getTranslations({locale, namespace: "Nav"}),
    getTranslations({locale, namespace: "Footer"})
  ]);

  let themePreference: "system" | "light" | "dark" = "system";
  let session: Awaited<ReturnType<typeof auth>> = null;
  let unreadNotifications = 0;

  try {
    session = await auth();

    if (session?.user?.id) {
      const [preferences, unreadCount] = await Promise.all([
        prisma.userPreference.findUnique({
          where: {userId: session.user.id},
          select: {theme: true}
        }),
        prisma.notification.count({
          where: {userId: session.user.id, readAt: null}
        })
      ]);
      unreadNotifications = unreadCount;

      if (preferences?.theme === "LIGHT") themePreference = "light";
      if (preferences?.theme === "DARK") themePreference = "dark";
    }
  } catch (error) {
    console.error("SimSoar navigation preferences could not be loaded:", error);
  }

  const isAuthenticated = Boolean(session?.user);
  const canUseAdmin = hasRole(session?.user?.roles, "MODERATOR");
  const isDevelopmentEnvironment = process.env.NEXT_PUBLIC_SIMSOAR_ENV === "dev";
  const primaryItems = [
    {href: "/" as const, label: nav("home")},
    {href: "/flights" as const, label: nav("flights")},
    {href: "/upload" as const, label: nav("upload")},
    {href: "/pilots" as const, label: nav("pilots")}
  ];
  const secondaryItems = [
    {href: "/clubs" as const, label: nav("clubs")},
    {href: "/competitions" as const, label: nav("competitions")},
    {href: "/leagues" as const, label: nav("leagues")},
    {href: "/tasks" as const, label: nav("tasks")},
    {href: "/segments" as const, label: nav("segments")}
  ];
  const allItems = [...primaryItems, ...secondaryItems];

  return (
    <html lang={locale} data-theme={themePreference} suppressHydrationWarning>
      <body className={isDevelopmentEnvironment ? "hasDevBanner" : undefined}>
        <NextIntlClientProvider messages={messages}>
          <a className="skipLink" href="#main-content">{nav("skipToContent")}</a>

          {isDevelopmentEnvironment ? (
            <div className="devBanner">
              DEV ENVIRONMENT – SimSoar Development
            </div>
          ) : null}

          <header className="siteHeader">
            <nav className="nav" aria-label={nav("primaryNavigation")}>
              <div className="navInner">
                <Link className="logo" href="/">
                  <span className="logoMark" aria-hidden="true">🛩</span>
                  <span>SimSoar</span>
                </Link>

                <div className="navLinks">
                  {primaryItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
                  <details className="navMore">
                    <summary>{nav("more")}</summary>
                    <div className="navMorePanel">
                      {secondaryItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
                    </div>
                  </details>
                </div>

                <div className="navRight">
                  {session?.user?.id ? (
                    <Link className="btn btnSecondary notificationNavLink" href="/notifications" aria-label={nav("notifications", {count: unreadNotifications})}>
                      <span aria-hidden="true">🔔</span>
                      {unreadNotifications > 0 ? <span className="notificationBadge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}
                    </Link>
                  ) : null}
                  <QuickThemeToggle />

                  <div className="desktopNavUtilities">
                    <LocaleSwitcher />
                    <Suspense fallback={null}>
                      <AuthNav locale={locale} isAuthenticated={isAuthenticated} canUseAdmin={canUseAdmin} />
                    </Suspense>
                  </div>

                  <details className="mobileMenu">
                    <summary aria-label={nav("menu")} title={nav("menu")}>
                      <span aria-hidden="true" className="menuIcon"><i /><i /><i /></span>
                    </summary>
                    <div className="mobileMenuPanel">
                      <div className="mobileMenuLinks">
                        {allItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
                      </div>
                      <div className="mobileMenuUtilities">
                        <LocaleSwitcher />
                        <Suspense fallback={null}>
                          <AuthNav locale={locale} isAuthenticated={isAuthenticated} canUseAdmin={canUseAdmin} />
                        </Suspense>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </nav>
          </header>

          <div id="main-content" className="pageShell" tabIndex={-1}>
            {children}
          </div>

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
