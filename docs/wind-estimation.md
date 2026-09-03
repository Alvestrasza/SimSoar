# Wind estimation

SimSoar derives an approximate wind vector from the displacement of detected thermal segments. It compares centroids near the beginning and end of each thermal to reduce the effect of individual circling points. The displayed direction is the meteorological direction the wind comes from.

Every estimate is classified as low, medium, or high confidence using the observed duration, drift distance, and sample count. The flight-level estimate excludes low-confidence thermals and averages the remaining drift vectors. Per-thermal values remain visible with their confidence so uncertainty is explicit.

This result is a technical estimate from an uploaded flight track. It is not official weather data and must not be used as a safety-critical weather source.
