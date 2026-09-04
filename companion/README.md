# SimSoar Companion

The SimSoar Companion is optional. SimSoar's web application remains fully usable without it. The first supported operating system is Windows; the client uses Node.js 22 and the same package, OAuth, and consent rules on additional platforms.

The companion is deliberately not a general-purpose launcher or updater. It contains no shell, command, plug-in, or downloaded-script execution path. It only writes validated data files below an exact, user-approved installation root. Detection lists candidates but never approves them. Result watching only lists IGC candidates and never uploads automatically.

## Authentication boundary

The companion never accepts or stores an account password, access token, refresh token, authorization code, or client secret. Obtain a short-lived OAuth access token through an approved public client using Authorization Code with PKCE and the `flights.upload` scope, then pipe only that access token to the one upload command through standard input. Revoke consent in the SimSoar profile and identity-provider account when access is no longer required.

## Windows-first workflow

Use Node.js 22 or later. All state is written below the per-user application-data directory unless `--config=...` explicitly selects another file.

```powershell
node .\companion\src\cli.mjs init --api=https://simsoar.example --confirm
node .\companion\src\cli.mjs detect
node .\companion\src\cli.mjs approve-install-root --path=D:\Simulator\ApprovedTasks --confirm
node .\companion\src\cli.mjs approve-result-root --path=D:\Simulator\Results --confirm
```

Before installation, calculate and inspect the downloaded package SHA-256. Installation requires the exact digest and an explicit confirmation:

```powershell
node .\companion\src\cli.mjs install --package=D:\Downloads\task.simsoar-task.json --root=D:\Simulator\ApprovedTasks --simulator="MSFS 2024" --confirm-package-sha=<sha256> --confirm
```

The client validates schema version, simulator compatibility, every declared path, byte size, and SHA-256. Executable and script extensions, traversal, absolute paths, undeclared files, oversized content, corrupt content, and incompatible packages are rejected. Existing destination files are copied to `.simsoar-backup/<timestamp>` before replacement. Rollback consists of closing the simulator and copying the desired backup files back to their original relative paths.

Scan or watch an approved result directory:

```powershell
node .\companion\src\cli.mjs scan --root=D:\Simulator\Results
node .\companion\src\cli.mjs watch --root=D:\Simulator\Results
```

An upload requires the exact selected file, its displayed SHA-256, a separate confirmation flag, simulator name, and an access token over standard input. Visibility defaults to private:

```powershell
Get-Content -Raw .\short-lived-token.txt | node .\companion\src\cli.mjs upload --file=D:\Simulator\Results\flight.igc --simulator="MSFS 2024" --visibility=PRIVATE --confirm-upload=<sha256> --token-stdin --confirm
```

Delete the temporary token file immediately after use. Prefer piping from an operating-system protected credential broker; the companion never creates a token file.

## Signed updates and rollback

Companion releases must publish an artifact and an Ed25519-signed manifest containing only `version`, `artifactSha256`, and `publishedAt`. Configure the pinned public JWK out of band, then verify before replacing an installed client:

```powershell
node .\companion\src\cli.mjs verify-update --manifest=D:\Downloads\manifest.json --artifact=D:\Downloads\simsoar-companion.zip
```

Keep the previously verified artifact until the new version passes `detect`, package validation, and a non-uploading result scan. Roll back by restoring that artifact and its matching signed manifest. Configuration format changes must remain backward compatible or include a data-only migration; an update may never execute a downloaded migration script.

## Diagnostics

Normal output contains package IDs, hashes, relative package paths, and redacted paths. Authentication headers, tokens, authorization codes, secrets, URL query credentials, IGC contents, and account passwords are never logged. Review every diagnostic before sharing it.
