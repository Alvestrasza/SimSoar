# Task planner

Authenticated pilots can create and edit map-based soaring tasks. Every task stores its owner, name, optional description, visibility, calculated route distance, and an ordered list of waypoints. Each waypoint contains optional name and code fields, decimal coordinates, and an observation radius. Route distances are recalculated on the server with the haversine formula instead of trusting browser input.

Public tasks appear in the task directory. Unlisted tasks are accessible through their direct link but are not listed for other users. Private tasks are only available to their owner. These rules are applied by the server for every task view and mutation.

The comparison view overlays a selected visible flight and the planned route. A task counts as completed only when the stored flight track enters every waypoint observation radius in order. It also reports partial coverage and the nearest stored track point for waypoints that were not reached. This is a technical comparison of stored track samples, not an official competition result.

The normalized waypoint model is intentionally independent of a particular exchange format. CUP import and export can map into the same ordered waypoint records without replacing planner data.
