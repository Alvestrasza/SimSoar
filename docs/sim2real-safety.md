# Sim2Real safety boundary

Sim2Real is an explicit preliminary review mode. It does not approve a route, establish legal compliance, replace current official briefing products, or decide whether a real flight is safe. The pilot in command remains responsible for weather, NOTAM, AIS, airspace, aerodrome, terrain, alternates, aircraft performance, local procedures, and every operational decision.

The review shows the source and timestamp of every safety-relevant dataset. Missing, stale, ambiguous, or truncated data is displayed as a warning or unknown result and can never appear as a passed check. A lack of detected intersections is only a result for the loaded dataset, not proof of clearance.

## Checks and limitations

- Route length is calculated from the current task revision.
- Estimated duration uses the pilot's entered cruise-speed assumption.
- Imported OpenAir polygons are checked for horizontal route intersections.
- A vertical intersection is reported only when a planned altitude and parseable floor and ceiling labels exist. Flight levels are approximate geometric conversions and do not replace pressure, terrain, or operational calculations.
- Terrain clearance remains unknown until a current suitable terrain dataset and aircraft model are configured.
- Aerodrome and alternate suitability remains unknown until current suitable data exists and is independently reviewed.
- Weather and NOTAM data are not integrated. Configurable HTTPS briefing links are starting points only.

## Export contract

Export requires a current explicit review and the exact current task revision. The `.json` planning bundle contains a prominent draft warning, review version, generation time, task lineage and revision, data provenance, assumptions, findings, and a base64-encoded CUP task whose name is prefixed with `[PLANNING DRAFT]`. It is data-only and contains no executable content.

If the task changes after review, the prior export URL fails with a conflict and a new review is required. The response is private, not cached, and marked with `X-SimSoar-Planning-Draft: true`.

Operators may configure region-specific official starting points through `SIMSOAR_BRIEFING_LINKS_JSON`, an array of objects with `label` and HTTPS `url`. Configuration must not describe a link as integrated, complete, authoritative for every region, or sufficient on its own.
