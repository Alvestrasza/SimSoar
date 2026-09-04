# Legacy flight import

The legacy importer migrates IGC-backed flights from a prototype, Supabase export, or another SimSoar installation. It deliberately does not create authentication accounts: every manifest entry maps to one existing SimSoar user by `targetUserId` or `targetUserEmail`.

Dry-run is the default and still reads the target database so user mappings, blocked uploads, and duplicate hashes can be validated. No database or upload-file changes are made until `--apply` is supplied.

```bash
node --experimental-strip-types scripts/import-legacy-data.mjs \
  --manifest ./legacy/manifest.json \
  --source-dir ./legacy/igc \
  --report ./legacy/dry-run-report.json
```

Review the report, back up the target database and upload directory, then apply the same manifest:

```bash
node --experimental-strip-types scripts/import-legacy-data.mjs \
  --manifest ./legacy/manifest.json \
  --source-dir ./legacy/igc \
  --apply \
  --report ./legacy/apply-report.json
```

The report file is created exclusively and is never overwritten. Omit `--report` to emit JSON only to standard output. A report contains per-flight successes, failures, blocked hashes, skipped duplicates, and a summary. A non-zero exit code indicates invalid command input or at least one failed flight.

## Manifest format

```json
{
  "version": 1,
  "defaults": {"simulator": "Legacy simulator", "visibility": "PRIVATE"},
  "flights": [
    {
      "sourceId": "legacy-flight-001",
      "igcPath": "2024/example.igc",
      "targetUserEmail": "existing-pilot@example.invalid",
      "pilotCallsign": "PILOT",
      "title": "Imported legacy flight",
      "createdAt": "2024-05-01T12:00:00.000Z"
    }
  ]
}
```

IGC paths must be relative and stay inside `--source-dir`. Each `sourceId` must be unique. Optional flight fields are `simulator`, `visibility`, `registration`, `glider`, `competitionClass`, `comment`, `title`, and `createdAt`. The target user's account must already exist.

Existing IGC hashes are skipped. Replacement requires all three explicit arguments `--apply`, `--overwrite`, and `--confirm-overwrite=REPLACE_EXISTING_FLIGHTS`. Replacement keeps the existing flight identifier and related community activity while replacing ownership, metadata, and derived analysis. It should only be used after a verified backup. Blocked IGC hashes are never imported or replaced.

The importer uses the normal IGC parser and upload limits. Imported files are stored below `UPLOAD_DIR`, or `uploads` when it is unset. Imports intentionally do not send follower notifications. Recalculate badges, competitions, leagues, and segments with the normal administrative maintenance procedure after a large migration.
