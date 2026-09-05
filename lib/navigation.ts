export const NAVIGATION_SIDES = ["LEFT", "RIGHT"] as const;
export type NavigationSide = (typeof NAVIGATION_SIDES)[number];

export function navigationSide(value: unknown): NavigationSide {
  return value === "RIGHT" ? "RIGHT" : "LEFT";
}

export const FLIGHT_NAVIGATION = [
  {href: "/flights", label: "flights", icon: "flight"},
  {href: "/pilots", label: "pilots", icon: "pilot"},
  {href: "/clubs", label: "clubs", icon: "club"},
  {href: "/competitions", label: "competitions", icon: "trophy"},
  {href: "/leagues", label: "leagues", icon: "league"},
  {href: "/tasks", label: "tasks", icon: "task"},
  {href: "/segments", label: "segments", icon: "segment"},
  {href: "/journal", label: "journal", icon: "journal"}
] as const;

export function isNavigationActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
