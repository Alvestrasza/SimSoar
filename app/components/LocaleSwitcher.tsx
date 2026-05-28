"use client";

import Link from "next/link";
import {useLocale, useTranslations} from "next-intl";
import {usePathname} from "next/navigation";

const LOCALE_PREFIX = /^\/(de|en)(?=\/|$)/;

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  const pathWithoutLocale = pathname.replace(LOCALE_PREFIX, "") || "/";

  const deHref = `/de${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
  const enHref = `/en${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

  return (
    <div className="localeSwitcher" aria-label={t("label")}>
      <Link
        href={deHref}
        className={locale === "de" ? "active" : undefined}
        aria-current={locale === "de" ? "true" : undefined}
      >
        DE
      </Link>

      <span>/</span>

      <Link
        href={enHref}
        className={locale === "en" ? "active" : undefined}
        aria-current={locale === "en" ? "true" : undefined}
      >
        EN
      </Link>
    </div>
  );
}