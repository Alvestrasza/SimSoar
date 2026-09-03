# Airspace overlay and crossing checks

Administrators can import polygonal airspace data in the OpenAir text format. SimSoar supports the `AC`, `AN`, `AL`, `AH`, and `DP` records with decimal or degrees/minutes/seconds polygon coordinates. Upload size, polygon count, and point count are bounded; imports and removals are audit logged.

Active polygons can be enabled as an optional layer on a flight map. SimSoar checks stored flight-track points and connecting segments against every available polygon and lists possible crossings with the relevant track range.

The check is two-dimensional and depends entirely on the imported dataset. Floor and ceiling values are displayed as source labels but are not evaluated against altitude. The result is a technical visualization, not legal advice, navigation data, or an operational flight clearance.
