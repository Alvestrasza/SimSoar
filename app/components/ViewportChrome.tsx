"use client";

import {useLayoutEffect} from "react";

/** Reserve the actual chrome height, including translated text and zoom wrapping. */
export default function ViewportChrome() {
  useLayoutEffect(() => {
    const body = document.body;
    const header = document.querySelector<HTMLElement>(".siteHeader");
    const banner = document.querySelector<HTMLElement>(".devBanner");
    const footer = document.querySelector<HTMLElement>(".siteFooter");
    if (!header || !footer) return;

    function measure() {
      const bannerHeight = Math.ceil(banner?.getBoundingClientRect().height ?? 0);
      const headerHeight = Math.ceil(header!.getBoundingClientRect().height);
      const footerHeight = Math.ceil(footer!.getBoundingClientRect().height);
      body.style.setProperty("--shell-banner-height", `${bannerHeight}px`);
      body.style.setProperty("--shell-header-height", `${headerHeight}px`);
      body.style.setProperty("--shell-footer-height", `${footerHeight}px`);
      document.documentElement.style.setProperty("--shell-scroll-top", `${bannerHeight + headerHeight + 12}px`);
      document.documentElement.style.setProperty("--shell-scroll-bottom", `${footerHeight + 12}px`);
    }

    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [header, banner, footer]) if (element) observer.observe(element);
    return () => {
      observer.disconnect();
      for (const name of ["--shell-banner-height", "--shell-header-height", "--shell-footer-height"]) body.style.removeProperty(name);
      for (const name of ["--shell-scroll-top", "--shell-scroll-bottom"]) document.documentElement.style.removeProperty(name);
    };
  }, []);

  return null;
}
