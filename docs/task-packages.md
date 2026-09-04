# SimSoar task packages

SimSoar task packages are portable, versioned, data-only JSON documents. They are intended for explicit import by simulator integrations and the optional desktop companion. A package never contains or authorizes executable code.

## Format and lineage

The media type is `application/json`; the recommended extension is `.simsoar-task.json`. `format` must be `simsoar-task-package` and `manifest.schemaVersion` currently must be `1.0.0`. The JSON Schema is published in [`task-package-manifest.schema.json`](task-package-manifest.schema.json).

Each saved task has a stable `lineageId`. Every edit increments `revision`. `packageId` combines lineage and revision, so an importer can distinguish updates from unrelated tasks. The manifest also records generation time, task update time, compatibility, dependencies, file hashes, licenses, source URLs, and provenance.

## Hosted files and external dependencies

Every hosted file is declared in `manifest.files` and embedded in `files` as base64. Each declaration contains its exact byte size and SHA-256 digest. Dependencies are references only: their HTTPS source, version, license, required/optional status, and hash (when supplied) are recorded in `manifest.dependencies`. Importers must not silently fetch optional dependencies.

## Safe import contract

Before writing any file, an importer must validate the complete package and reject it if any of these checks fail:

- supported format and schema version;
- supported simulator and version;
- package size, file count, and per-file size limits;
- one payload for every declaration and no undeclared or duplicate file;
- relative normalized paths only, with no traversal, absolute paths, drive prefixes, backslashes, or control characters;
- ordinary files only—links and special filesystem entries are forbidden;
- no executable or script extensions;
- text media types only;
- exact decoded size and SHA-256 digest;
- HTTPS URLs for external sources and valid hashes when supplied.

The reference validator exposes validated files in memory. A client should then write them only below a user-approved simulator data directory, using non-overwriting temporary files followed by an atomic rename. It must never execute package content.

## Compatibility and privacy

The first package target is the simulator-neutral SeeYou CUP format (`generic-cup`, version `1.0.0`). Additional simulators can be added as explicit compatibility records without changing the container format. An unsupported target is a hard validation failure.

SimSoar increments only an aggregate counter when a package is downloaded. It does not add downloader identity, IP address, or user-agent data to task package analytics.
