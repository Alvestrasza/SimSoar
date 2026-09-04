export const COMPANION_MAX_IGC_BYTES = 10 * 1024 * 1024;
export const COMPANION_MAX_REQUEST_BYTES = COMPANION_MAX_IGC_BYTES + 64 * 1024;

export class CompanionUploadPolicyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function validateCompanionContentLength(value: string | null) {
  if (!value || !/^\d+$/.test(value)) throw new CompanionUploadPolicyError("content_length_required");
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > COMPANION_MAX_REQUEST_BYTES) throw new CompanionUploadPolicyError("request_too_large");
  return bytes;
}

export function validateExplicitUploadConfirmation(value: string | null, sha256: string) {
  if (!value || value !== sha256) throw new CompanionUploadPolicyError("upload_confirmation_required");
}

export function validateCompanionFormShape(keys: string[], fileCount: number) {
  const allowed = new Set(["igc", "simulator", "visibility", "registration", "glider", "competitionClass", "comment"]);
  if (fileCount !== 1) throw new CompanionUploadPolicyError("invalid_file_count");
  if (keys.some((key) => !allowed.has(key))) throw new CompanionUploadPolicyError("unexpected_field");
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  if ([...counts.values()].some((count) => count !== 1)) throw new CompanionUploadPolicyError("duplicate_field");
}

export function validateCompanionUploadFields(input: Record<string, unknown>) {
  const simulator = typeof input.simulator === "string" ? input.simulator.trim() : "";
  const visibility: "PUBLIC" | "UNLISTED" | "PRIVATE" = input.visibility === "PUBLIC" || input.visibility === "UNLISTED" || input.visibility === "PRIVATE" ? input.visibility : "PRIVATE";
  if (simulator.length < 2 || simulator.length > 40) throw new CompanionUploadPolicyError("invalid_simulator");
  const bounded = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) || null : null;
  return {simulator, visibility, registration: bounded(input.registration, 40), glider: bounded(input.glider, 80), competitionClass: bounded(input.competitionClass, 80), comment: bounded(input.comment, 2000)};
}
