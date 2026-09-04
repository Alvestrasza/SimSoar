# Group flight replay

The comparison page can replay two to five public, approved flights on one shared timeline. Each flight keeps its comparison color and line pattern, and a numbered marker shows its current position. Pilots can be shown or hidden independently without changing the linkable flight selection in the URL.

When every selected track has complete, strictly increasing timestamps, SimSoar aligns the flights by their recorded UTC times. If one track has incomplete timestamps, each flight starts at zero and uses the same resilient interval fallback as the single-flight replay. Playback supports seeking, play, pause, reset, and speeds from 0.5× to 8×.

The replay is a reusable client component fed by an explicit flight list. Competition and event pages can therefore embed it later without weakening the public-flight visibility checks enforced by the comparison page.
