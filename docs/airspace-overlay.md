# Airspace overlay and crossing checks

Administrators can import airspace data in the OpenAir text format. SimSoar supports the `AC`, `AN`, `AL`, `AH`, `DP`, `V X=`, `V D=`, `DC`, `DB`, and `DA` records with decimal or degrees/minutes/seconds coordinates. Circles and arcs are converted to bounded geodesic polygon approximations before storage. Exports which already resolve arcs into polygon points, including regional OpenFlightMaps exports, are accepted directly.

Large regional datasets are written in bounded database batches. The default limits allow files up to 100 MiB, 50,000 airspaces, 50,000 points in one airspace, and 2,000,000 points in one import. Hard application ceilings remain in place to protect memory and database capacity. Operators can lower or raise the defaults within those ceilings with `SIMSOAR_AIRSPACE_MAX_BYTES`, `SIMSOAR_AIRSPACE_MAX_COUNT`, `SIMSOAR_AIRSPACE_MAX_POINTS_PER_AIRSPACE`, `SIMSOAR_AIRSPACE_MAX_TOTAL_POINTS`, and `SIMSOAR_AIRSPACE_IMPORT_TIMEOUT_MS`. `MAX_SERVER_ACTION_BODY_SIZE` controls the build-time request-body limit and must remain larger than the chosen file limit.

Each airspace stores a bounding box. Flight pages query only active airspaces whose bounds overlap the recorded track instead of loading an arbitrary global subset. The administration list is paginated for large datasets. Upload size, geometry counts, imports, and removals remain bounded and audit logged.

Active polygons can be enabled as an optional layer on a flight map. SimSoar checks stored flight-track points and connecting segments against every available polygon and lists possible crossings with the relevant track range.

The check is two-dimensional and depends entirely on the imported dataset. Floor and ceiling values are displayed as source labels but are not evaluated against altitude. The result is a technical visualization, not legal advice, navigation data, or an operational flight clearance.
