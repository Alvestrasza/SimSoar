# Flight authenticity and anti-cheat evidence

SimSoar can accept bounded, data-only evidence from approved simulator companion clients. Evidence increases confidence in a result; it does not prove that a human did not cheat. SimSoar never deletes a flight, changes a score, or disqualifies a pilot automatically because of an authenticity finding.

## Trust boundary

- Keycloak remains the only authorization server. Companion clients use an approved OAuth client and the `flights.upload` scope.
- A user registers an Ed25519 public key with `POST /api/v1/evidence/keys`. Private keys remain in the companion client and must never be sent to SimSoar.
- A key can be revoked with `POST /api/v1/evidence/keys/{keyId}/revoke`. A revoked key ID cannot be reused; rotate to a new key ID.
- `POST /api/v1/flights/{flightId}/evidence` accepts an evidence object and, optionally, its Ed25519 signature. The signature covers canonical JSON for the complete evidence object.
- Every write requires an idempotency key. Requests and stored summaries are size-bounded. Raw simulator logs, access tokens, private keys, device identifiers, and unrelated personal data are not stored.

## Evidence schema v1

Required fields are `version`, `flightId`, `igcSha256`, and `simulator`. Optional fields are `simulatorVersion`, `aircraft`, `weather`, `taskPackageId`, `taskPackageSha256`, `startedAt`, `endedAt`, `attemptId`, and `logSha256`. Undeclared fields are rejected.

Each accepted submission creates an immutable revision. A corrected submission creates a new revision and does not overwrite the earlier evidence. The steward view contains only bounded metadata, hashes, status, finding codes, and the appeal record.

## Status model

- `VERIFIED`: no supported check produced a finding.
- `INCOMPLETE`: required or useful evidence is missing. Missing evidence is not invalid evidence.
- `FLAGGED`: at least one consistency, signature, or reuse check failed.
- `UNSUPPORTED`: the evidence schema cannot be evaluated. Unsupported evidence is not treated as invalid.

An invalid finding takes precedence when the same submission also uses an unsupported version. A steward must review the evidence, applicable competition rules, and any appeal before taking a separate moderation action.

## Finding catalogue

| Code | Category | Severity | Meaning |
| --- | --- | --- | --- |
| `EVIDENCE_VERSION_UNSUPPORTED` | Unsupported | Warning | The evidence version is not implemented. |
| `FLIGHT_ID_MISMATCH` | Invalid | Critical | Evidence names a different flight. |
| `IGC_HASH_MISMATCH` | Invalid | Critical | The bound IGC hash differs from the stored upload. |
| `SIMULATOR_MISMATCH` | Invalid | Critical | Simulator identity differs from the uploaded flight. |
| `AIRCRAFT_MISMATCH` | Invalid | Warning | Aircraft metadata differs. |
| `WEATHER_MISMATCH` | Invalid | Warning | Weather mode metadata differs. |
| `START_TIME_MISMATCH` | Invalid | Warning | Start timestamps differ by more than five minutes. |
| `DURATION_MISMATCH` | Invalid | Warning | Duration differs beyond the configured tolerance. |
| `ATTEMPT_REUSED` | Invalid | Critical | The same attempt identifier is bound to another flight. |
| `SIGNATURE_INVALID` | Invalid | Critical | The signature cannot be verified with the registered active key. |
| `SIGNATURE_MISSING` | Missing | Warning | No signed companion evidence was supplied. |
| `REQUIRED_FIELD_MISSING` | Missing | Warning | A competition-required evidence field is absent. |
| `REQUIRED_SIGNATURE_MISSING` | Missing | Warning | A competition requires signed evidence. |
| `REQUIRED_TASK_PACKAGE_MISSING` | Missing | Warning | A competition task package is required but absent. |
| `TASK_PACKAGE_MISMATCH` | Invalid | Critical | Evidence references a different task package. |

## Competition policies and review

Administrators can enable evidence rules per competition, limit them to named simulators, require selected evidence fields, require a signature, and bind a round to a task package. Existing flights remain intact when a policy changes.

The pilot can appeal any non-verified revision from the flight page. The appeal is audit logged and visible to moderators. A moderator records an accepted or rejected decision with a reason. An appeal decision documents the review; it does not silently rewrite evidence, status, score, or moderation state. Corrections use a new evidence revision so the original record remains traceable.

## Operational guidance

Companion clients should generate a distinct attempt identifier before the simulated flight, hash the task package and resulting log locally, submit evidence only after the IGC upload succeeds, and rotate keys after suspected compromise. Competition organizers should publish evidence requirements before a round and provide an appeal deadline and steward contact in the competition rules.
