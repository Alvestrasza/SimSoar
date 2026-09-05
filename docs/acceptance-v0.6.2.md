# v0.6.2 development acceptance

Application commits: [`b78071e`](https://github.com/Alvestrasza/SimSoar/commit/b78071e95436cb67fae7f05b1d79fbb714be58d2) (navigation, density and private journal) and [`6a52dd5`](https://github.com/Alvestrasza/SimSoar/commit/6a52dd53dec2d648630870c5a84663fbaf348388) (narrow-viewport correction).

Scope: issues #75, #76 and #77, assigned to the existing v0.6.0 milestone. The visible application build was incremented from v0.6.1 to v0.6.2 after browser verification exposed a legacy 320px document minimum-width problem. No production promotion is included.

## Verified

- 158 automated tests pass, including five navigation checks and eight private-journal checks.
- Prisma schema validation and client generation, a fresh TypeScript check, and an optimized Next.js build pass locally.
- Independent journal review exercised real image decoding/re-encoding, metadata removal, invalid inputs, owner-scoped reads, unauthenticated access, foreign/stale edit rejection and private response headers. Executable mocked boundaries supplement the test suite; they do not establish database-backed end-to-end acceptance.
- The additive migration applied successfully in DEV. Both DEV instances subsequently passed all 158 tests and optimized builds for exact application commit `6a52dd53dec2d648630870c5a84663fbaf348388`, reported healthy services and HTTP `200`, and rendered v0.6.2. No pending migrations remained.
- Anonymous journal requests redirect to sign-in; anonymous journal-image requests return `404`; protected companion upload still returns `401` without authorization.
- Browser checks of v0.6.1 covered desktop Flights in German/English, light/dark presentation, active sidebar links, Home and Flights at mobile widths, and Pilot table-local scrolling. Mobile menu selection, outside clicks and Escape close the menu; Escape returns focus to the summary.
- At 390px, page content remained within the viewport and the wide Pilot table scrolled in its own container. The initial 320px check exposed the old document minimum width, fixed in v0.6.2 together with the mobile menu's scrollbar/banner allowance.
- The final v0.6.2 browser check confirmed Home at 320px and Flights at 390px without document overflow (document scroll width equalled client width). At 320px, the entire opened menu stayed inside the viewport, including its language/sign-in controls; Escape closed it and restored summary focus. No browser-console errors were observed. Temporary viewport overrides were reset afterwards.
- The production dependency audit retains zero critical findings. The three high entries are the previously documented single `deepmerge-ts` advisory through the Prisma toolchain; this feature update does not remediate that advisory.

## Acceptance still required

- Authenticated Profile and Journal browser checks, including saving and persisting left/right placement.
- Real PostgreSQL activity projections and equal-timestamp pagination, concurrent quota/version checks, authenticated note/photo create/edit/delete and cross-user negative tests.
- Photo availability and cleanup across both application instances using the actual protected upload storage.

The automated acceptance browser has no authenticated session. The existing operational account cannot read the protected DEV database settings, and no credentials were copied or access permissions widened. A private, disposable-fixture acceptance harness is prepared but has not been executed. The issues remain open until these remaining acceptance checks are completed.

The journal reconstructs surviving domain records rather than promising a complete historical audit trail. See [Pilot Journal](pilot-journal.md) for limits, privacy and storage requirements, and [Navigation and layout](navigation-and-layout.md) for usage.
