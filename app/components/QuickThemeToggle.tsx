"use client";

import {useEffect, useState} from "react";

type EffectiveTheme = "light" | "dark";

function getEffectiveTheme(): EffectiveTheme {
  const storedOverride = window.localStorage.getItem("simsoar.quickThemeOverride");

  if (storedOverride === "light" || storedOverride === "dark") {
    return storedOverride;
  }

  const currentTheme = document.documentElement.dataset.theme;

  if (currentTheme === "light" || currentTheme === "dark") {
    return currentTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: EffectiveTheme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("simsoar.quickThemeOverride", theme);
}

export default function QuickThemeToggle() {
  const [theme, setTheme] = useState<EffectiveTheme | null>(null);

  useEffect(() => {
    const initialTheme = getEffectiveTheme();
    applyTheme(initialTheme);
    setTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  return (
    <button
      className="themeQuickToggle"
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
