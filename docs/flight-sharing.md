# Public flight sharing and embeds

Every approved public flight has a stable localized detail URL. Its metadata includes a specific title, description, canonical URL, OpenGraph fields, a Twitter summary card, and a generated SVG route preview. The preview is derived from a bounded simplification of the stored track and does not call an external map or image service.

The flight page offers link sharing and a copyable iframe. The embed endpoint is intentionally small, sends a restrictive content security policy, accepts `lang=de` or `lang=en`, and contains only the flight title, public summary metrics, generated route preview, and a link to SimSoar.

All metadata, preview, embed, and sharing controls use the same database boundary: the flight must be public, approved, and not deleted. Unlisted flights remain accessible through their existing direct detail URL but do not receive public sharing metadata or an embed. Private, moderated, or deleted flights return a generic not-found response. Changing visibility therefore revokes existing embeds without a separate cleanup job.

Set `NEXT_PUBLIC_SITE_URL` to the canonical external origin. `AUTH_URL` is used as a fallback. Host headers are never used to build public links.
