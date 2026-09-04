# Glide and cruise analysis

SimSoar identifies continuous non-thermal track sections as glide or cruise phases. A phase must last at least 30 seconds, cover at least 250 metres, and contain no recording gap longer than 30 seconds.

For every detected phase SimSoar stores its original track boundaries, duration, flown distance, average ground speed, average vertical speed, and effective glide ratio. The glide ratio is shown only when the phase has a measurable net altitude loss. The measurements are derived from the uploaded IGC track and are not a substitute for calibrated aircraft performance data.

The flight detail page presents thermal and glide totals together, followed by the individual glide phases. These deterministic records provide a stable basis for future performance advice without changing the original IGC data.
