# 3D flight replay

The flight detail view includes a lightweight WebGL visualization that presents longitude, latitude, and altitude as a normalized three-dimensional route.

- The blue line represents the flight path and its vertical altitude development.
- A ground projection and a vertical stem make the current altitude easier to read.
- The orange marker follows the same timeline, play/pause state, and speed selection as the map and altitude chart.

The renderer uses no third-party 3D service and sends no flight data away from SimSoar. If WebGL context or shader initialization is unavailable, the component switches automatically to a synchronized top-down 2D canvas route. The standard Leaflet map remains available in its separate tab in every browser.
