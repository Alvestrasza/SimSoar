export type BulkUploadLimits = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBulkUploadLimits(
  environment: Record<string, string | undefined> = process.env
): BulkUploadLimits {
  return {
    maxFiles: positiveInteger(environment.MAX_IGC_UPLOAD_FILES, 10),
    maxFileBytes: positiveInteger(
      environment.MAX_IGC_UPLOAD_BYTES,
      10 * 1024 * 1024
    ),
    maxTotalBytes: positiveInteger(
      environment.MAX_IGC_BULK_UPLOAD_BYTES,
      50 * 1024 * 1024
    )
  };
}

export type BatchLimitError = "missing-file" | "too-many-files" | "total-size";

export function validateBatchLimits(
  files: ArrayLike<{size: number}>,
  limits: BulkUploadLimits
): BatchLimitError | null {
  if (files.length === 0) {
    return "missing-file";
  }

  if (files.length > limits.maxFiles) {
    return "too-many-files";
  }

  let totalBytes = 0;
  for (let index = 0; index < files.length; index += 1) {
    totalBytes += files[index].size;
  }

  return totalBytes > limits.maxTotalBytes ? "total-size" : null;
}

export function displayUploadFileName(name: string): string {
  const normalized = name.trim() || "upload.igc";
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`;
}
