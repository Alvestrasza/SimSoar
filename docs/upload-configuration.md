# IGC upload configuration

SimSoar validates every uploaded IGC file independently. Bulk uploads use the
same per-file validation and duplicate protection as single-file uploads.

The following environment variables control upload limits:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `MAX_IGC_UPLOAD_FILES` | `10` | Maximum number of files in one submission. |
| `MAX_IGC_UPLOAD_BYTES` | `10485760` | Maximum size of one file in bytes. |
| `MAX_IGC_BULK_UPLOAD_BYTES` | `52428800` | Maximum combined file size in one submission. |
| `MAX_IGC_BULK_BODY_SIZE` | `55mb` | Next.js request-body limit applied at build time. |

`MAX_IGC_BULK_BODY_SIZE` must be large enough for the configured combined
file size plus multipart form overhead. Invalid, missing, or non-positive
numeric values for the first three settings fall back to the documented
defaults.
