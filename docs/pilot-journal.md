# Private pilot journal

The pilot journal is available at `/{locale}/journal` for every authenticated account. It is private to its owner, including images. There is no public sharing switch and no administrator exception to journal authorization.

## Activity timeline

The latest 30 activities are displayed first. The next-page cursor uses the exact timestamp and a stable, namespaced record ID; database comparisons explicitly use the `C` collation to avoid ambiguous ordering across activity types. Each of the 12 source queries returns at most 31 candidates before the combined page is selected.

The initial history is reconstructed from existing domain records: uploaded flights, created tasks, current club memberships, competition entries, league entries, current follows, enabled earned badges, comments, likes, CUP imports and completed segments. Manually dated entries are merged into the same timeline.

This is not an immutable record of every historical change. Removed records, past memberships/follows and previous revisions cannot be reconstructed. Flight activities use the upload date, rather than a simulator's potentially different flight date. Manual entries use their chosen calendar date at noon UTC; automatic events show their recorded timestamp in UTC. A changed manual date can move an entry between pages, so return to the latest page after editing.

Security, login, administration and moderation audit records are never projected. Comments and likes on another pilot's flight disappear from this view if that flight ceases to be an approved public flight. All queries are scoped to the authenticated owner, including the image lookup after timeline pagination.

## Writing and editing

Owners can create, edit and delete entries with a title (1–120 characters), plain text (1–10,000 characters), and a valid date from 1900 through today. Text is rendered through React escaping; HTML is not interpreted. Forms retain typed text after validation failure. Stale edits are rejected using an integer version, and deletion requires an explicit checkbox confirmation.

An entry can contain up to four still JPEG, PNG or WebP images of at most 5 MiB each. Both file signature and declared MIME type are checked. Images must decode successfully, have at most 20 million pixels, and have no side exceeding 8,192 pixels. Re-encoding to WebP applies orientation and strips EXIF/GPS metadata, trailing data and the original filename. Animated images are rejected. Existing photos can be removed while editing.

Each account is limited to 5,000 manual entries and 500 MiB of journal image data. A per-process, per-account limiter allows 12 mutations per minute before image decoding. Entry ownership and version are checked before image processing, then checked again inside a database transaction. A row lock on the owner serializes quota, version, upload and delete checks across application nodes. This process limiter is supplementary; deployments should retain their existing reverse-proxy request and body limits.

## Storage and operations

Images live under `UPLOAD_DIR/journal/<hashed-user-id>/<random-uuid>.webp`, never under the public web directory. The database stores a constrained relative storage key. Every file operation validates the expected owner, refuses directory symlinks and bounds reads; creation is exclusive. Direct image responses use `private, no-store`, `nosniff`, a sandbox content policy and same-origin resource policy. Next.js image optimization is disabled for these URLs to preserve authenticated requests and prevent shared image caching.

Application nodes must use the same protected upload storage and service identity, or an equivalent storage replication design that makes saved images available on every node. Include journal tables and this directory in coordinated backups. Normal entry and photo deletions remove the database references first and then their files. A failed database mutation removes newly written files. Process interruption or account deletion can leave inaccessible orphan files; reconcile unreferenced journal objects against the database during maintenance, under the storage boundary checks, rather than deleting directories blindly.

The additive migration also adds the `LEFT`/`RIGHT` navigation preference. Roll back application code by leaving the new tables and preference column in place; do not drop journal data during an application rollback. Journal audit events record the actor, entry ID and image count only, never text, filenames, storage paths or image contents.

## Verification

Run `node --experimental-strip-types --test tests/journal.test.mjs` for date/cursor boundaries, private access policy, image decode/re-encode and metadata removal, quotas, real filesystem ownership and traversal rejection, and error-message safety. Full acceptance additionally requires PostgreSQL-backed page ordering and simultaneous-write checks, authenticated create/edit/delete and image authorization, and both-node storage availability in the target environment.
