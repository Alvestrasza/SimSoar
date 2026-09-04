# Flight replay

Flight detail pages provide a time-based replay for tracks with at least two points.

## Timeline

The replay uses consecutive IGC timestamps when they are available and increasing. Missing or invalid intervals fall back to one second so older or incomplete tracks remain controllable. The timeline supports play, pause, reset, direct seeking, and 0.5x to 8x playback speeds.

## Synchronized views

- The map displays an aircraft marker at the current track point.
- The altitude chart displays a cursor at the corresponding altitude sample.
- When the current sequence is inside a detected thermal range, the aircraft marker and altitude cursor use the thermal highlight colour and the controls identify the active thermal.

Replay runs entirely in the browser from the already authorized flight detail payload. It does not broaden access to track data or perform additional flight-data requests.
