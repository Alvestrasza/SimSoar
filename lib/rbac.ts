export const SIMSOAR_ROLE_ORDER = [
  "USER",
  "PILOT",
  "MODERATOR",
  "ADMIN",
  "OWNER"
] as const;

export type SimSoarRole = (typeof SIMSOAR_ROLE_ORDER)[number];

const KEYCLOAK_ROLE_MAP: Record<string, SimSoarRole> = {
  // Preferred SimSoar role names used by Keycloak client roles.
  "simsoar_user": "USER",
  "simsoar_pilot": "PILOT",
  "simsoar_moderator": "MODERATOR",
  "simsoar_admin": "ADMIN",
  "simsoar_owner": "OWNER",

  // Alternative role names with hyphen separator.
  "simsoar-user": "USER",
  "simsoar-pilot": "PILOT",
  "simsoar-moderator": "MODERATOR",
  "simsoar-admin": "ADMIN",
  "simsoar-owner": "OWNER",

  // AD-/group-style names.
  "app-simsoar-users": "USER",
  "app-simsoar-pilots": "PILOT",
  "app-simsoar-moderators": "MODERATOR",
  "app-simsoar-admins": "ADMIN",
  "app-simsoar-owners": "OWNER",

  // AD-/group-style names with underscore separator.
  "app_simsoar_users": "USER",
  "app_simsoar_pilots": "PILOT",
  "app_simsoar_moderators": "MODERATOR",
  "app_simsoar_admins": "ADMIN",
  "app_simsoar_owners": "OWNER"
};

type KeycloakResourceAccess = Record<
  string,
  {
    roles?: unknown;
  }
>;

type KeycloakProfileWithRoles = {
  simsoar_roles?: unknown;
  realm_access?: {
    roles?: unknown;
  };
  resource_access?: KeycloakResourceAccess;
  groups?: unknown;
};

function normalizeRoleName(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase();
}

function normalizeGroupRoleName(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function inferRoleFromEnvironmentGroup(value: string): SimSoarRole | null {
  const normalized = normalizeGroupRoleName(value);

  if (!normalized.includes("simsoar_")) {
    return null;
  }

  const environment = getSimSoarRuntimeEnvironment();

  if (
    environment &&
    (normalized.includes("simsoar_dev_") || normalized.includes("simsoar_prod_")) &&
    !normalized.includes(`simsoar_${environment}_`)
  ) {
    return null;
  }

  if (normalized.endsWith("_owners") || normalized.endsWith("_owner")) {
    return "OWNER";
  }

  if (normalized.endsWith("_admins") || normalized.endsWith("_admin")) {
    return "ADMIN";
  }

  if (normalized.endsWith("_moderators") || normalized.endsWith("_moderator")) {
    return "MODERATOR";
  }

  if (normalized.endsWith("_pilots") || normalized.endsWith("_pilot")) {
    return "PILOT";
  }

  if (normalized.endsWith("_users") || normalized.endsWith("_user")) {
    return "USER";
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function normalizeAccessValue(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function getSimSoarRuntimeEnvironment(): "dev" | "prod" | null {
  const rawEnvironment = (
    process.env.SIMSOAR_ENV ??
    process.env.NEXT_PUBLIC_SIMSOAR_ENV ??
    ""
  )
    .trim()
    .toLowerCase();

  if (rawEnvironment === "dev" || rawEnvironment === "development") {
    return "dev";
  }

  if (rawEnvironment === "prod" || rawEnvironment === "production") {
    return "prod";
  }

  return null;
}

export function hasSimSoarEnvironmentAccess(values: unknown[]): boolean {
  const environment = getSimSoarRuntimeEnvironment();

  if (!environment) {
    return true;
  }

  const requiredMarker = `simsoar_${environment}_`;

  return values
    .filter((value): value is string => typeof value === "string")
    .map(normalizeAccessValue)
    .some((value) => value.includes(requiredMarker));
}

export function normalizeSimSoarRoles(values: unknown[]): SimSoarRole[] {
  const roles = new Set<SimSoarRole>();

  for (const value of values) {
    if (typeof value !== "string") continue;

    const direct = value.trim().toUpperCase();

    if ((SIMSOAR_ROLE_ORDER as readonly string[]).includes(direct)) {
      roles.add(direct as SimSoarRole);
      continue;
    }

    const mapped =
      KEYCLOAK_ROLE_MAP[normalizeRoleName(value)] ??
      KEYCLOAK_ROLE_MAP[normalizeGroupRoleName(value)] ??
      inferRoleFromEnvironmentGroup(value);

    if (mapped) {
      roles.add(mapped);
    }
  }

  roles.add("USER");

  return [...roles].sort(
    (a, b) => SIMSOAR_ROLE_ORDER.indexOf(a) - SIMSOAR_ROLE_ORDER.indexOf(b)
  );
}

export function extractKeycloakRoleValues(
  profile: unknown,
  clientId?: string
): string[] {
  const keycloakProfile = profile as KeycloakProfileWithRoles | null;
  const values: string[] = [];

  values.push(...toStringArray(keycloakProfile?.simsoar_roles));
  values.push(...toStringArray(keycloakProfile?.realm_access?.roles));
  values.push(...toStringArray(keycloakProfile?.groups));

  if (clientId && keycloakProfile?.resource_access?.[clientId]?.roles) {
    values.push(...toStringArray(keycloakProfile.resource_access[clientId].roles));
  }

  return values;
}

export function hasRole(
  userRoles: readonly string[] | undefined,
  requiredRole: SimSoarRole
): boolean {
  const normalizedRoles = normalizeSimSoarRoles([...(userRoles ?? [])]);
  const highestRole = normalizedRoles.at(-1) ?? "USER";

  return (
    SIMSOAR_ROLE_ORDER.indexOf(highestRole) >=
    SIMSOAR_ROLE_ORDER.indexOf(requiredRole)
  );
}
