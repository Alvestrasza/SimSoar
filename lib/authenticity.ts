import crypto from "node:crypto";

export const EVIDENCE_VERSION = "1.0.0" as const;
export const EVIDENCE_FIELDS = ["simulatorVersion", "aircraft", "weather", "taskPackageId", "taskPackageSha256", "startedAt", "endedAt", "attemptId", "logSha256"] as const;
export type EvidenceField = typeof EVIDENCE_FIELDS[number];
export type FindingCategory = "MISSING" | "INVALID" | "UNSUPPORTED";
export type FindingSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AuthenticityFinding = {code: string; category: FindingCategory; severity: FindingSeverity; competitionId?: string};

export type FlightEvidence = {
  version: string; flightId: string; igcSha256: string; simulator: string; simulatorVersion: string | null;
  aircraft: string | null; weather: string | null; taskPackageId: string | null; taskPackageSha256: string | null;
  startedAt: string | null; endedAt: string | null; attemptId: string | null; logSha256: string | null;
};

export class AuthenticityError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

function boundedString(value: unknown, maximum: number, nullable = true) {
  if ((value === null || value === undefined) && nullable) return null;
  if (typeof value !== "string") throw new AuthenticityError("invalid_evidence");
  const result = value.trim();
  if (!result || result.length > maximum || /[\x00-\x1f]/.test(result)) throw new AuthenticityError("invalid_evidence");
  return result;
}

export function parseFlightEvidence(value: unknown): FlightEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthenticityError("invalid_evidence");
  const record = value as Record<string, unknown>;
  const allowed = new Set(["version", "flightId", "igcSha256", "simulator", ...EVIDENCE_FIELDS]);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new AuthenticityError("undeclared_evidence_field");
  const result: FlightEvidence = {
    version: boundedString(record.version, 20, false)!,
    flightId: boundedString(record.flightId, 100, false)!,
    igcSha256: boundedString(record.igcSha256, 64, false)!,
    simulator: boundedString(record.simulator, 80, false)!,
    simulatorVersion: boundedString(record.simulatorVersion, 80), aircraft: boundedString(record.aircraft, 120), weather: boundedString(record.weather, 120),
    taskPackageId: boundedString(record.taskPackageId, 300), taskPackageSha256: boundedString(record.taskPackageSha256, 64),
    startedAt: boundedString(record.startedAt, 40), endedAt: boundedString(record.endedAt, 40), attemptId: boundedString(record.attemptId, 120), logSha256: boundedString(record.logSha256, 64)
  };
  for (const hash of [result.igcSha256, result.taskPackageSha256, result.logSha256]) if (hash !== null && !/^[a-f0-9]{64}$/.test(hash)) throw new AuthenticityError("invalid_evidence_hash");
  for (const timestamp of [result.startedAt, result.endedAt]) if (timestamp !== null && !Number.isFinite(Date.parse(timestamp))) throw new AuthenticityError("invalid_evidence_time");
  return result;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new AuthenticityError("invalid_evidence");
}

export function evidenceSha256(evidence: FlightEvidence) {
  return crypto.createHash("sha256").update(canonicalJson(evidence), "utf8").digest("hex");
}

export function validateEd25519PublicJwk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthenticityError("invalid_public_key");
  const jwk = value as Record<string, unknown>;
  if (Object.keys(jwk).some((key) => !["kty", "crv", "x"].includes(key)) || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(jwk.x)) throw new AuthenticityError("invalid_public_key");
  try { crypto.createPublicKey({key: jwk as JsonWebKey, format: "jwk"}); } catch { throw new AuthenticityError("invalid_public_key"); }
  return {kty: "OKP", crv: "Ed25519", x: jwk.x} as const;
}

export function publicKeyFingerprint(jwk: {kty: "OKP"; crv: "Ed25519"; x: string}) {
  return crypto.createHash("sha256").update(canonicalJson(jwk), "utf8").digest("hex");
}

export function verifyEvidenceSignature(evidence: FlightEvidence, signature: string, jwk: unknown) {
  if (!/^[A-Za-z0-9_-]{86}$/.test(signature)) return false;
  try {
    const key = crypto.createPublicKey({key: validateEd25519PublicJwk(jwk), format: "jwk"});
    return crypto.verify(null, Buffer.from(canonicalJson(evidence), "utf8"), key, Buffer.from(signature, "base64url"));
  } catch { return false; }
}

export function evaluateFlightEvidence(input: {
  evidence: FlightEvidence;
  flight: {id: string; igcSha256: string; simulator: string; glider: string | null; weatherMode: string; startTime: Date | null; durationSeconds: number};
  signature: {present: boolean; valid: boolean};
  duplicateAttempt: boolean;
  competitions: Array<{id: string; evidenceRequired: boolean; evidenceSimulators: string[]; requiredEvidenceFields: string[]; requireSignedEvidence: boolean; requiredTaskPackageId: string | null}>;
}) {
  const {evidence, flight} = input;
  const findings: AuthenticityFinding[] = [];
  const add = (code: string, category: FindingCategory, severity: FindingSeverity, competitionId?: string) => findings.push({code, category, severity, ...(competitionId ? {competitionId} : {})});
  if (evidence.version !== EVIDENCE_VERSION) add("EVIDENCE_VERSION_UNSUPPORTED", "UNSUPPORTED", "WARNING");
  if (evidence.flightId !== flight.id) add("FLIGHT_ID_MISMATCH", "INVALID", "CRITICAL");
  if (evidence.igcSha256 !== flight.igcSha256) add("IGC_HASH_MISMATCH", "INVALID", "CRITICAL");
  if (evidence.simulator.toLowerCase() !== flight.simulator.toLowerCase()) add("SIMULATOR_MISMATCH", "INVALID", "CRITICAL");
  if (evidence.aircraft && flight.glider && evidence.aircraft.toLowerCase() !== flight.glider.toLowerCase()) add("AIRCRAFT_MISMATCH", "INVALID", "WARNING");
  if (evidence.weather && flight.weatherMode !== "UNKNOWN" && evidence.weather.toLowerCase() !== flight.weatherMode.toLowerCase()) add("WEATHER_MISMATCH", "INVALID", "WARNING");
  if (evidence.startedAt && flight.startTime && Math.abs(Date.parse(evidence.startedAt) - flight.startTime.getTime()) > 5 * 60 * 1000) add("START_TIME_MISMATCH", "INVALID", "WARNING");
  if (evidence.startedAt && evidence.endedAt) {
    const claimedDuration = (Date.parse(evidence.endedAt) - Date.parse(evidence.startedAt)) / 1000;
    if (claimedDuration <= 0 || Math.abs(claimedDuration - flight.durationSeconds) > Math.max(120, flight.durationSeconds * 0.05)) add("DURATION_MISMATCH", "INVALID", "WARNING");
  }
  if (input.duplicateAttempt) add("ATTEMPT_REUSED", "INVALID", "CRITICAL");
  if (input.signature.present && !input.signature.valid) add("SIGNATURE_INVALID", "INVALID", "CRITICAL");
  if (!input.signature.present) add("SIGNATURE_MISSING", "MISSING", "WARNING");

  for (const competition of input.competitions) {
    if (!competition.evidenceRequired) continue;
    if (competition.evidenceSimulators.length && !competition.evidenceSimulators.some((simulator) => simulator.toLowerCase() === flight.simulator.toLowerCase())) continue;
    for (const field of competition.requiredEvidenceFields) {
      if (EVIDENCE_FIELDS.includes(field as EvidenceField) && !evidence[field as EvidenceField]) add("REQUIRED_FIELD_MISSING", "MISSING", "WARNING", competition.id);
    }
    if (competition.requireSignedEvidence && !input.signature.present) add("REQUIRED_SIGNATURE_MISSING", "MISSING", "WARNING", competition.id);
    if (competition.requiredTaskPackageId && evidence.taskPackageId !== competition.requiredTaskPackageId) add(evidence.taskPackageId ? "TASK_PACKAGE_MISMATCH" : "REQUIRED_TASK_PACKAGE_MISSING", evidence.taskPackageId ? "INVALID" : "MISSING", evidence.taskPackageId ? "CRITICAL" : "WARNING", competition.id);
  }

  const status = findings.some((finding) => finding.category === "INVALID") ? "FLAGGED"
    : findings.some((finding) => finding.category === "UNSUPPORTED") ? "UNSUPPORTED"
      : findings.some((finding) => finding.category === "MISSING") ? "INCOMPLETE" : "VERIFIED";
  return {status: status as "VERIFIED" | "INCOMPLETE" | "FLAGGED" | "UNSUPPORTED", findings};
}

export function boundedEvidenceSummary(evidence: FlightEvidence) {
  return {
    simulator: evidence.simulator, simulatorVersion: evidence.simulatorVersion, aircraft: evidence.aircraft, weather: evidence.weather,
    taskPackageId: evidence.taskPackageId, taskPackageSha256: evidence.taskPackageSha256, startedAt: evidence.startedAt,
    endedAt: evidence.endedAt, attemptId: evidence.attemptId, logSha256: evidence.logSha256
  };
}
