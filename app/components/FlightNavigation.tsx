"use client";

import {useTranslations} from "next-intl";
import {Link, usePathname} from "@/i18n/navigation";
import {FLIGHT_NAVIGATION, isNavigationActive} from "@/lib/navigation";

const paths = {
  flight: "m3 12 7-2 1-7h2l1 7 7 2v2l-7-1-1 6h-2l-1-6-7 1z",
  pilot: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  club: "M9 9a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6 21v-2a6 6 0 0 1 12 0v2M4 5a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 19v-2a5 5 0 0 1 2-4m18 6v-2a5 5 0 0 0-2-4",
  trophy: "M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10",
  league: "M4 21V11h5v10m1 0V4h5v17m1 0v-7h5v7M3 21h19",
  task: "M7 3h10v4H7zM7 5H4v16h16V5h-3M8 12h8m-8 5h5",
  segment: "M5 5h5m4 14h5M5 8v8a3 3 0 0 0 3 3h3m8-3V8a3 3 0 0 0-3-3h-3M2 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm14 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  journal: "M4 3h7l1 2 1-2h7v17h-7l-1 1-1-1H4zM12 5v16M7 8h2m6 0h2M7 12h2m6 0h2"
};

export default function FlightNavigation({mobile = false}: {mobile?: boolean}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    <nav className={mobile ? "flightNavigation flightNavigationMobile" : "flightNavigation"} aria-label={t("flightNavigation")}>
      {FLIGHT_NAVIGATION.map((item) => (
        <Link key={item.href} href={item.href} className="flightNavigationLink" title={t(item.label)} aria-current={isNavigationActive(pathname, item.href) ? "page" : undefined}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[item.icon]} /></svg>
          <span>{t(item.label)}</span>
        </Link>
      ))}
    </nav>
  );
}
