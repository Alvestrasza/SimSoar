# Task planner

Authenticated pilots can create and edit map-based soaring tasks. Every task stores its owner, name, optional description, visibility, calculated route distance, and an ordered list of waypoints. Each waypoint contains optional name and code fields, decimal coordinates, and an observation radius. Route distances are recalculated on the server with the haversine formula instead of trusting browser input.

Public tasks appear in the task directory. Unlisted tasks are accessible through their direct link but are not listed for other users. Private tasks are only available to their owner. These rules are applied by the server for every task view and mutation.

The comparison view overlays a selected visible flight and the planned route. A task counts as completed only when the stored flight track enters every waypoint observation radius in order. It also reports partial coverage and the nearest stored track point for waypoints that were not reached. This is a technical comparison of stored track samples, not an official competition result.

The normalized waypoint model is intentionally independent of a particular exchange format. CUP import and export can map into the same ordered waypoint records without replacing planner data.

## CUP import

The import accepts the header-driven SeeYou CUP waypoint format in UTF-8 or legacy Windows-1252 encoding. Column order is not fixed. Names and WGS-84 degree/minute coordinates are required; codes, country, elevation, style, and description are retained when present. A bounded personal waypoint library makes imported points available in the planner.

The optional `-----Related Tasks-----` section is resolved against the imported waypoint names. Supported related tasks are created as private tasks and observation-zone `R1` values are mapped to bounded waypoint radii. Exact duplicate files are rejected per user by SHA-256. Parsing failures include a stable error category and, where available, the source line. Imports are limited to 10 MiB, 20,000 waypoints, and 100 tasks.

## CUP export

Task owners can export any of their tasks. Other visitors can export public tasks; unlisted and private task downloads remain restricted to their owner. The UTF-8 download contains header-driven waypoint records, unique generated waypoint names where necessary, the related task, and bounded observation-zone radii. Its sanitized filename combines the task name and creation date.
