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
import "../navigation.css";
import {AuthNav} from "@/app/components/AuthNav";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import QuickThemeToggle from "@/app/components/QuickThemeToggle";
import {hasRole} from "@/lib/rbac";
import type {Session} from "next-auth";
import ClosableNavigationMenu from "@/app/components/ClosableNavigationMenu";
import SortableTables from "@/app/components/SortableTables";
import FlightNavigation from "@/app/components/FlightNavigation";
import {navigationSide, type NavigationSide} from "@/lib/navigation";

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
  let session: Session | null = null;
  let unreadNotifications = 0;
  let preferredNavigationSide: NavigationSide = "LEFT";

  try {
    session = await auth();

    if (session?.user?.id) {
      const [preferences, unreadCount] = await Promise.all([
        prisma.userPreference.findUnique({
          where: {userId: session.user.id},
          select: {theme: true, navigationSide: true}
        }),
        prisma.notification.count({
          where: {userId: session.user.id, readAt: null}
        })
      ]);
      unreadNotifications = unreadCount;
      preferredNavigationSide = navigationSide(preferences?.navigationSide);

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
    {href: "/upload" as const, label: nav("upload")}
  ];

  return (
    <html lang={locale} data-theme={themePreference} suppressHydrationWarning>
      <body className={isDevelopmentEnvironment ? "hasDevBanner" : undefined}>
        <NextIntlClientProvider messages={messages}>
          <SortableTables />
          <a className="skipLink" href="#main-content">{nav("skipToContent")}</a>

          {isDevelopmentEnvironment ? (
            <div className="devBanner">
              DEV ENVIRONMENT – SimSoar Development
            </div>
          ) : null}

          <header className="siteHeader">
            <div className="nav">
              <div className="navInner">
                <Link className="logo" href="/">
                  <span className="logoMark" aria-hidden="true">🛩</span>
                  <span>SimSoar</span>
                </Link>

                <nav className="navLinks" aria-label={nav("primaryNavigation")}>
                  {primaryItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
                </nav>

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

                  <ClosableNavigationMenu
                    className="mobileMenu"
                    panelClassName="mobileMenuPanel"
                    summary={<span aria-hidden="true" className="menuIcon"><i /><i /><i /></span>}
                    summaryAriaLabel={nav("menu")}
                    summaryTitle={nav("menu")}
                  >
                    <nav className="mobileMenuLinks" aria-label={nav("primaryNavigation")}>
                      {primaryItems.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
                    </nav>
                    <FlightNavigation mobile />
                    <div className="mobileMenuUtilities">
                      <LocaleSwitcher />
                      <Suspense fallback={null}>
                        <AuthNav locale={locale} isAuthenticated={isAuthenticated} canUseAdmin={canUseAdmin} />
                      </Suspense>
                    </div>
                  </ClosableNavigationMenu>
                </div>
              </div>
            </div>
          </header>

          <div className="workspaceFrame" data-navigation-side={preferredNavigationSide}>
            <aside className="flightSidebar"><FlightNavigation /></aside>
            <div className="workspaceBody">
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
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
