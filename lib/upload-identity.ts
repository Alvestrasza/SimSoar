const MIN_CALLSIGN_LENGTH = 2;
const MAX_CALLSIGN_LENGTH = 40;

export function bindUploadPilotIdentity<T extends Record<string, unknown>>(
  submittedFields: T,
  profileCallsign: unknown
): Omit<T, "pilotCallsign"> & {pilotCallsign: string} {
  const pilotCallsign = typeof profileCallsign === "string"
    ? profileCallsign.trim()
    : "";

  if (
    pilotCallsign.length < MIN_CALLSIGN_LENGTH ||
    pilotCallsign.length > MAX_CALLSIGN_LENGTH
  ) {
    throw new Error("A valid pilot profile callsign is required to upload flights.");
  }

  const {pilotCallsign: _untrustedPilotCallsign, ...trustedFields} = submittedFields;
  return {...trustedFields, pilotCallsign};
}
