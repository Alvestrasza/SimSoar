"use client";

import {useLocale, useTranslations} from "next-intl";
import {usePathname, useRouter} from "next/navigation";

const LOCALE_PREFIX = /^\/(de|en)(?=\/|$)/;

const SUPPORTED_LOCALES = [
  {value: "de", label: "Deutsch"},
  {value: "en", label: "English"}
];

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const pathWithoutLocale = pathname.replace(LOCALE_PREFIX, "") || "/";

  function changeLocale(nextLocale: string) {
    const nextPath = `/${nextLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
    router.push(nextPath);
  }

  return (
    <label className="localeSelectWrap" aria-label={t("label")}>
      <span className="srOnly">{t("label")}</span>

      <select
        className="navSelect"
        value={locale}
        onChange={(event) => changeLocale(event.target.value)}
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
