# Navigation and layout

The v0.6.1 interface separates global actions from flight-data destinations.

- The top header retains Home, Upload, notifications, theme, language and account actions.
- The flight-data sidebar contains Flights, Pilots, Clubs, Competitions, Leagues, Tasks, Segments and the private Pilot Journal.
- In **My Profile → Preferences → Flight-data sidebar position**, choose **Left** or **Right** and save. The setting is stored in the authenticated user's preferences. New users and signed-out visitors default to the left.
- At viewport widths of 1080px or less, flight-data links move into the header's menu. The menu closes after selecting a link, clicking outside it, or pressing Escape. Desktop placement does not change mobile navigation.
- Current destinations, including their detail pages, are highlighted. Navigation links have keyboard focus indicators and accessible names.

Shared content containers use a fluid, parent-constrained maximum width of 1600px. Cards, forms, tables and hero sections use reduced spacing and restrained decoration; tables retain their own horizontal scrolling where needed. Map and replay sizing are not altered by the shared density update. Mobile controls retain touch-friendly target heights.

## Maintainer notes

`lib/navigation.ts` is the shared destination and placement definition. `FlightNavigation` renders both the desktop and mobile links; the existing closable menu owns dismissal behavior. Global sizing/theme tokens live at the beginning of `app/globals.css`; sidebar layout lives in `app/navigation.css`. Avoid appending conflicting width/theme overrides at the end of the global stylesheet.

Placement is validated in the preferences server action and constrained to `LEFT`/`RIGHT` by the additive database migration. This is an appearance preference, not an authorization mechanism. The Pilot Journal enforces its own authentication and ownership checks regardless of whether its link is displayed.

Delivery is tracked in #75 and #76 in the v0.6.0 milestone. A DEV acceptance result is not authorization to promote this build to PROD.
