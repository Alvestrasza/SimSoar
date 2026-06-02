import {
  getSimSoarRuntimeEnvironment,
  normalizeSimSoarRoles,
  type SimSoarRole
} from "@/lib/rbac";

type KeycloakUserRepresentation = {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  attributes?: Record<string, string[]>;
};

type KeycloakGroupRepresentation = {
  id?: string;
  name?: string;
  path?: string;
  subGroups?: KeycloakGroupRepresentation[];
};

const SIMSOAR_GROUP_SUFFIX_BY_ROLE: Record<SimSoarRole, string[]> = {
  USER: ["Users", "User"],
  PILOT: ["Pilots", "Pilot"],
  MODERATOR: ["Moderators", "Moderator"],
  ADMIN: ["Admins", "Admin"],
  OWNER: ["Owners", "Owner"]
};

function normalizeKeycloakGroupName(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function flattenGroups(groups: KeycloakGroupRepresentation[]): KeycloakGroupRepresentation[] {
  const result: KeycloakGroupRepresentation[] = [];

  for (const group of groups) {
    result.push(group);

    if (group.subGroups?.length) {
      result.push(...flattenGroups(group.subGroups));
    }
  }

  return result;
}

function getSimSoarEnvironmentLabel(): "DEV" | "PROD" {
  const environment = getSimSoarRuntimeEnvironment();

  if (environment === "dev") return "DEV";
  if (environment === "prod") return "PROD";

  throw new Error("SIMSOAR_ENV or NEXT_PUBLIC_SIMSOAR_ENV must be set to dev or prod.");
}

function getSimSoarGroupPrefix(): string {
  return process.env.KEYCLOAK_SIMSOAR_GROUP_PREFIX ?? "00005-2-LS-SimSoar";
}

function getCandidateGroupNamesForRole(role: SimSoarRole): string[] {
  const environmentLabel = getSimSoarEnvironmentLabel();
  const prefix = getSimSoarGroupPrefix();

  return SIMSOAR_GROUP_SUFFIX_BY_ROLE[role].map(
    (suffix) => `${prefix}_${environmentLabel}_${suffix}`
  );
}

function groupMatchesAnyName(
  group: KeycloakGroupRepresentation,
  names: readonly string[]
): boolean {
  const normalizedNames = new Set(names.map(normalizeKeycloakGroupName));
  const candidates = [group.name, group.path].filter(
    (value): value is string => typeof value === "string"
  );

  return candidates.some((candidate) =>
    normalizedNames.has(normalizeKeycloakGroupName(candidate))
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getKeycloakRealmBaseUrl(): string {
  const issuer = requiredEnv("AUTH_KEYCLOAK_ISSUER").replace(/\/$/, "");

  // issuer: https://login.alvestrasza.com/realms/<realm>
  if (!issuer.includes("/realms/")) {
    throw new Error("AUTH_KEYCLOAK_ISSUER must contain /realms/<realm>.");
  }

  return issuer;
}

function getKeycloakAdminBaseUrl(): string {
  const explicitAdminRealmUrl = process.env.KEYCLOAK_ADMIN_REALM_URL?.replace(/\/$/, "");

  if (explicitAdminRealmUrl) {
    return explicitAdminRealmUrl;
  }

  const issuer = getKeycloakRealmBaseUrl();
  const [baseUrl, realm] = issuer.split("/realms/");

  return `${baseUrl}/admin/realms/${encodeURIComponent(realm)}`;
}

async function getKeycloakAdminAccessToken(): Promise<string> {
  const issuer = getKeycloakRealmBaseUrl();

  const tokenUrl = `${issuer}/protocol/openid-connect/token`;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", requiredEnv("KEYCLOAK_ADMIN_CLIENT_ID"));
  body.set("client_secret", requiredEnv("KEYCLOAK_ADMIN_CLIENT_SECRET"));

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak admin token request failed: ${response.status} ${text}`);
  }

  const tokenResponse = (await response.json()) as { access_token?: string };

  if (!tokenResponse.access_token) {
    throw new Error("Keycloak admin token response did not contain access_token.");
  }

  return tokenResponse.access_token;
}

export async function updateKeycloakUserCallsign(
  keycloakUserId: string,
  callsign: string
): Promise<void> {
  const attributeName = process.env.KEYCLOAK_CALLSIGN_ATTRIBUTE ?? "simsoar_callsign";

  const token = await getKeycloakAdminAccessToken();
  const adminBaseUrl = getKeycloakAdminBaseUrl();

  const userUrl = `${adminBaseUrl}/users/${encodeURIComponent(keycloakUserId)}`;

  const getResponse = await fetch(userUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!getResponse.ok) {
    const text = await getResponse.text();
    throw new Error(`Keycloak user read failed: ${getResponse.status} ${text}`);
  }

  const user = (await getResponse.json()) as KeycloakUserRepresentation;

  const updatedUser: KeycloakUserRepresentation = {
    ...user,
    attributes: {
      ...(user.attributes ?? {}),
      [attributeName]: [callsign]
    }
  };

  console.info("SimSoar Keycloak callsign update request:", {
    keycloakUserId,
    attributeName,
    callsign
  });

  const putResponse = await fetch(userUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatedUser)
  });

  if (!putResponse.ok) {
    const text = await putResponse.text();
    throw new Error(`Keycloak user update failed: ${putResponse.status} ${text}`);
  }

  const verifyResponse = await fetch(userUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!verifyResponse.ok) {
    const text = await verifyResponse.text();

    console.warn("SimSoar Keycloak callsign verification read failed after successful update:", {
      keycloakUserId,
      attributeName,
      callsign,
      status: verifyResponse.status,
      response: text
    });

    return;
  }

  const verifiedUser = (await verifyResponse.json()) as KeycloakUserRepresentation;
  const storedCallsign = verifiedUser.attributes?.[attributeName]?.[0] ?? null;

  console.info("SimSoar Keycloak callsign update verification:", {
    keycloakUserId,
    attributeName,
    expected: callsign,
    stored: storedCallsign
  });

  if (storedCallsign !== callsign) {
    console.warn("SimSoar Keycloak callsign verification did not return the expected value after successful update. This can happen with LDAP-backed attributes.", {
      keycloakUserId,
      attributeName,
      expected: callsign,
      stored: storedCallsign
    });
  }
}
async function fetchSimSoarRoleGroups(
  token: string,
  adminBaseUrl: string
): Promise<KeycloakGroupRepresentation[]> {
  const environmentLabel = getSimSoarEnvironmentLabel();
  const searchValue = `SimSoar_${environmentLabel}`;

  const groupsUrl = `${adminBaseUrl}/groups?search=${encodeURIComponent(
    searchValue
  )}&briefRepresentation=false&max=200`;

  const response = await fetch(groupsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak groups read failed: ${response.status} ${text}`);
  }

  const groups = (await response.json()) as KeycloakGroupRepresentation[];

  return flattenGroups(groups).filter((group) => {
    const groupName = `${group.name ?? ""} ${group.path ?? ""}`;
    return normalizeKeycloakGroupName(groupName).includes(
      `simsoar_${environmentLabel.toLowerCase()}_`
    );
  });
}

async function fetchUserGroups(
  token: string,
  adminBaseUrl: string,
  keycloakUserId: string
): Promise<KeycloakGroupRepresentation[]> {
  const userGroupsUrl = `${adminBaseUrl}/users/${encodeURIComponent(
    keycloakUserId
  )}/groups?briefRepresentation=false&max=200`;

  const response = await fetch(userGroupsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak user groups read failed: ${response.status} ${text}`);
  }

  const groups = (await response.json()) as KeycloakGroupRepresentation[];

  return flattenGroups(groups);
}

async function addUserToGroup(
  token: string,
  adminBaseUrl: string,
  keycloakUserId: string,
  groupId: string
): Promise<void> {
  const url = `${adminBaseUrl}/users/${encodeURIComponent(
    keycloakUserId
  )}/groups/${encodeURIComponent(groupId)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak user group add failed: ${response.status} ${text}`);
  }
}

async function removeUserFromGroup(
  token: string,
  adminBaseUrl: string,
  keycloakUserId: string,
  groupId: string
): Promise<void> {
  const url = `${adminBaseUrl}/users/${encodeURIComponent(
    keycloakUserId
  )}/groups/${encodeURIComponent(groupId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Keycloak user group remove failed: ${response.status} ${text}`);
  }
}

export async function updateKeycloakUserSimSoarRoleGroups(
  keycloakUserId: string,
  requestedRoles: readonly string[]
): Promise<void> {
  const token = await getKeycloakAdminAccessToken();
  const adminBaseUrl = getKeycloakAdminBaseUrl();

  const finalRoles = normalizeSimSoarRoles([...requestedRoles]);
  const desiredRoles = new Set<SimSoarRole>(finalRoles);

  desiredRoles.add("USER");

  const availableGroups = await fetchSimSoarRoleGroups(token, adminBaseUrl);
  const currentUserGroups = await fetchUserGroups(token, adminBaseUrl, keycloakUserId);

  const desiredGroupIds = new Set<string>();
  const managedGroupIds = new Set<string>();

  for (const role of normalizeSimSoarRoles(["USER", "PILOT", "MODERATOR", "ADMIN", "OWNER"])) {
    const candidates = getCandidateGroupNamesForRole(role);

    const group = availableGroups.find((candidateGroup) =>
      groupMatchesAnyName(candidateGroup, candidates)
    );

    if (!group?.id) {
      throw new Error(
        `Keycloak SimSoar group for role ${role} was not found. Tried: ${candidates.join(", ")}`
      );
    }

    managedGroupIds.add(group.id);

    if (desiredRoles.has(role)) {
      desiredGroupIds.add(group.id);
    }
  }

  const currentGroupIds = new Set(
    currentUserGroups
      .map((group) => group.id)
      .filter((id): id is string => typeof id === "string")
  );

  for (const groupId of managedGroupIds) {
    if (currentGroupIds.has(groupId) && !desiredGroupIds.has(groupId)) {
      await removeUserFromGroup(token, adminBaseUrl, keycloakUserId, groupId);
    }
  }

  for (const groupId of desiredGroupIds) {
    if (!currentGroupIds.has(groupId)) {
      await addUserToGroup(token, adminBaseUrl, keycloakUserId, groupId);
    }
  }

  console.info("SimSoar Keycloak role group update completed:", {
    keycloakUserId,
    environment: getSimSoarEnvironmentLabel(),
    roles: finalRoles,
    desiredGroupIds: [...desiredGroupIds]
  });
}
