"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

const LOCALE_PREFIX = /^\/(de|en)(?=\/|$)/;

export default function LocaleSwitcher() {
  const pathname = usePathname();

  const pathWithoutLocale = pathname.replace(LOCALE_PREFIX, "") || "/";

  const deHref = `/de${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;
  const enHref = `/en${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

  return (
    <div className="localeSwitcher" aria-label="Language switcher">
      <Link href={deHref}>DE</Link>
      <span>/</span>
      <Link href={enHref}>EN</Link>
    </div>
  );
}