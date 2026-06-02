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

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
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

    const mapped = KEYCLOAK_ROLE_MAP[normalizeRoleName(value)];

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
