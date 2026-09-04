# Security Review — v0.6.0

## Status

This document records the sanitized security posture of the SimSoar v0.6.0 development baseline. It covers source controls and DEV acceptance. It does not claim a production security certification, penetration test, or formal guarantee of absence of vulnerabilities.

- Release commit: `985928beebdc6c356939cdaaca8f71d4f1dc91f8`
- Main merge: `4941b09726ca00cc3bb642402729bcf5a905020a`
- Environment accepted: DEV only
- Production changed: no
- Open GitHub issues labelled `security` at acceptance: none

## Completed security work

| Issue | Control delivered |
| --- | --- |
| [#71](https://github.com/Alvestrasza/SimSoar/issues/71) | Patched vulnerable framework and production dependencies; deployment blocks critical audit findings. |
| [#72](https://github.com/Alvestrasza/SimSoar/issues/72) | Exact, environment-scoped Keycloak group and allowlisted client-role mapping with fail-closed behavior. |
| [#73](https://github.com/Alvestrasza/SimSoar/issues/73) | Upload ownership and callsign are derived from the authenticated pilot profile. |
| [#74](https://github.com/Alvestrasza/SimSoar/issues/74) | Protected flight-story images use private/no-store cache behavior; only approved public content may be publicly cached. |
| [#69](https://github.com/Alvestrasza/SimSoar/issues/69) | Revocable scoped OAuth, Authorization Code with PKCE, exact redirects, bounded tokens, endpoint scopes, rate limits, idempotency, and safe audit metadata. |
| [#51](https://github.com/Alvestrasza/SimSoar/issues/51) | Versioned data-only task packages with bounded contents, safe paths, compatibility declarations, and SHA-256 verification. |
| [#60](https://github.com/Alvestrasza/SimSoar/issues/60) | Ed25519 authenticity evidence with immutable revisions, explicit findings, corrections, appeals, and human moderation. |
| [#47](https://github.com/Alvestrasza/SimSoar/issues/47) | Sim2Real review gate with data provenance, fail-closed checks, pilot assumptions, alternatives, and non-operational planning labels. |
| [#53](https://github.com/Alvestrasza/SimSoar/issues/53) | Optional companion with explicit path and upload approvals, data-only installation, signed update checks, backups, and sanitized diagnostics. |

Earlier administration, role, audit, and upload-validation foundations remain tracked in [#1](https://github.com/Alvestrasza/SimSoar/issues/1), [#2](https://github.com/Alvestrasza/SimSoar/issues/2), [#4](https://github.com/Alvestrasza/SimSoar/issues/4), and [#40](https://github.com/Alvestrasza/SimSoar/issues/40).

## Trust boundaries

- Identity and MFA remain owned by the configured OIDC provider.
- Website roles do not bypass OAuth endpoint scopes.
- DEV and PROD roles, configuration, data, storage, and services must remain separated end to end.
- IGC files, story images, task packages, evidence, and companion inputs are treated as untrusted data.
- Uploads are bounded, validated, hashed, and identity-bound. Protected assets are not served from a public static directory.
- The companion never accepts an account password, stores bearer credentials, executes downloaded scripts, or provides a general command runner.
- Authenticity evidence raises or lowers confidence; it never proves that cheating is impossible and never causes automatic disqualification.
- Sim2Real output is a planning draft. It is not current navigation data, weather, NOTAM information, operational approval, or a substitute for pilot review.

## Acceptance evidence

The exact v0.6.0 release commit passed:

- 145 automated tests;
- Prisma schema validation and client generation;
- TypeScript checking;
- optimized Next.js production build;
- migration inspection with no pending DEV migration;
- consistent DEV commit and rendered version checks;
- public HTTP health checks;
- anonymous rejection (`401`) on protected authenticity and companion-upload write endpoints;
- dependency audit with zero critical findings.

Authentication and administrator access were also confirmed after the identity and authorization hardening. Runtime health, a successful build, and source publication are separate evidence levels; none alone proves the others.

## Residual findings

The production-omitted dependency audit still reports three high entries that represent one advisory: recursive-object stack exhaustion in `deepmerge-ts`, reached through `@prisma/config` and the Prisma CLI. The direct web-runtime package list does not include the Prisma CLI. No patched Prisma 6 release was available at acceptance, so eliminating this finding requires a controlled Prisma major upgrade with schema, generation, migration, build, and rollback testing.

This is not evidence that the application is vulnerability-free. Future work must continue to include dependency review, authorization regression tests, upload fuzzing, browser-level access checks, infrastructure review, backup/restore proof, and independent security testing before production promotion.

## Reporting vulnerabilities

Do not disclose suspected vulnerabilities in a public issue. Use the repository's private [security advisory form](https://github.com/Alvestrasza/SimSoar/security/advisories/new). Never include credentials, tokens, private user data, real infrastructure identifiers, or raw operational logs in reports.
