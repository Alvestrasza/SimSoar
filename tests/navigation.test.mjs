import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FLIGHT_NAVIGATION, NAVIGATION_SIDES, navigationSide, isNavigationActive} from "../lib/navigation.ts";

test("navigation defaults to left and only supports left/right", () => {
  assert.deepEqual(NAVIGATION_SIDES, ["LEFT", "RIGHT"]);
  for (const value of [null, undefined, "", "right", "TOP", {}, "LEFT"]) assert.equal(navigationSide(value), "LEFT");
  assert.equal(navigationSide("RIGHT"), "RIGHT");
});

test("active navigation matches exact routes and details, not prefix collisions", () => {
  assert.equal(isNavigationActive("/flights", "/flights"), true);
  assert.equal(isNavigationActive("/flights/abc/edit", "/flights"), true);
  assert.equal(isNavigationActive("/flightstory", "/flights"), false);
  assert.equal(isNavigationActive("/flights-other", "/flights"), false);
  assert.equal(isNavigationActive("/profile", "/"), false);
  assert.equal(isNavigationActive("/", "/"), true);
});

test("all flight destinations are unique, localized and include the private journal", () => {
  assert.equal(new Set(FLIGHT_NAVIGATION.map((item) => item.href)).size, FLIGHT_NAVIGATION.length);
  assert.ok(FLIGHT_NAVIGATION.some((item) => item.href === "/journal"));
  for (const locale of ["en", "de"]) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    for (const item of FLIGHT_NAVIGATION) assert.ok(messages.Nav[item.label]);
    for (const key of ["navigationSide", "navigationLeft", "navigationRight", "navigationHint"]) assert.ok(messages.Profile[key]);
  }
});

test("sidebar preferences are validated and persisted using authenticated identity", () => {
  const action = readFileSync(new URL("../app/[locale]/profile/preferences-actions.ts", import.meta.url), "utf8");
  assert.match(action, /navigationSide: z\.enum\(NAVIGATION_SIDES\)/);
  assert.match(action, /if \(!session\?\.user\?\.id\)/);
  assert.equal((action.match(/navigationSide: fields\.navigationSide/g) ?? []).length, 3);
  assert.match(action, /revalidatePath\(`\/\$\{fields.locale\}`, "layout"\)/);
  assert.doesNotMatch(action, /formData\.get\("userId"\)/);
});

test("the document can shrink below the viewport width when a scrollbar occupies space", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /html\s*\{\s*min-width:\s*0;/);
  assert.doesNotMatch(css, /html\s*\{[^}]*min-width:\s*320px/);
});

test("the edge rail uses square tiles and swaps the reserved content column", () => {
  const css = readFileSync(new URL("../app/navigation.css", import.meta.url), "utf8");
  assert.match(css, /\.workspaceFrame\s*\{[^}]*width:\s*100%;/);
  assert.match(css, /\.flightSidebar\s*\{[^}]*position:\s*fixed;/);
  assert.match(css, /\.flightSidebar\s*\{[^}]*left:\s*0;/);
  assert.match(css, /\[data-navigation-side="RIGHT"\] \.flightSidebar\s*\{[^}]*right:\s*0;/);
  assert.match(css, /\.flightSidebar \.flightNavigationLink\s*\{[^}]*aspect-ratio:\s*1;/);
});

test("viewport chrome reserves the measured footer and uses fluid wide-screen containers", () => {
  const css = readFileSync(new URL("../app/navigation.css", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/[locale]/layout.tsx", import.meta.url), "utf8");
  assert.match(css, /padding-bottom:\s*var\(--shell-footer-height\)/);
  assert.match(css, /\.appShell \.siteFooter\s*\{[^}]*position:\s*fixed;/);
  assert.match(css, /\.appShell \.siteFooter\s*\{[^}]*bottom:\s*0;/);
  assert.match(css, /@media \(min-width: 1900px\)[\s\S]*--content-width:\s*100%;/);
  assert.match(layout, /<ViewportChrome\s*\/>/);
});
