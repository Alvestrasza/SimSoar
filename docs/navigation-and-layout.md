# Navigation and layout

The interface separates global actions from flight-data destinations. Build v0.6.3 refines the original v0.6.1 layout into an edge-aligned tile rail.

- The top header retains Home, Upload, notifications, theme, language and account actions.
- The flight-data sidebar contains Flights, Pilots, Clubs, Competitions, Leagues, Tasks, Segments and the private Pilot Journal.
- Desktop navigation sits flush against the chosen viewport edge in a 92px rail. Square tiles have 32px symbols and compact labels; short windows scroll the rail independently so every destination stays reachable.
- In **My Profile → Preferences → Flight-data sidebar position**, choose **Left** or **Right** and save. The setting is stored in the authenticated user's preferences. New users and signed-out visitors default to the left.
- At viewport widths of 1080px or less, flight-data links move into the header's menu. The menu closes after selecting a link, clicking outside it, or pressing Escape. Desktop placement does not change mobile navigation.
- Current destinations, including their detail pages, are highlighted. Navigation links have keyboard focus indicators and accessible names.

Shared content containers retain their parent-constrained maximum width below 1900px. From 1900px onward the header, shared containers and top-level page wrappers grow with the viewport, leaving only a 20px content gutter beside the rail and outer edge. Cards, forms, tables and hero sections use reduced spacing and restrained decoration; tables retain their own horizontal scrolling where needed. Map and replay sizing are not altered by the shared density update. Mobile controls retain touch-friendly target heights.

The top navigation and footer remain visible while the document scrolls. Footer copyright, legal/project links and version stay available at the bottom. The layout measures actual header/banner/footer heights with one `ResizeObserver`, reserving space after wrapping, translation or zoom changes. The sidebar and mobile menu stop above the footer; page-end content and keyboard/anchor scrolling retain clearance. On narrow screens the footer wraps into compact rows. Print layout returns the footer to document flow.

## Maintainer notes

`lib/navigation.ts` is the shared destination and placement definition. `FlightNavigation` renders both the desktop and mobile links; the existing closable menu owns dismissal behavior. `ViewportChrome` measures viewport chrome without adding React state or scroll listeners. Global sizing/theme tokens live at the beginning of `app/globals.css`; sidebar and fixed-footer layout lives in `app/navigation.css`. Avoid appending conflicting width/theme overrides at the end of the global stylesheet.

Placement is validated in the preferences server action and constrained to `LEFT`/`RIGHT` by the additive database migration. This is an appearance preference, not an authorization mechanism. The Pilot Journal enforces its own authentication and ownership checks regardless of whether its link is displayed.

Delivery is tracked in #75 and #76 in the v0.6.0 milestone. A DEV acceptance result is not authorization to promote this build to PROD.
