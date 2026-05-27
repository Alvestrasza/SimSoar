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
    throw new Error(`Keycloak user verify read failed: ${verifyResponse.status} ${text}`);
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
    throw new Error(
      `Keycloak callsign sync verification failed. Expected "${callsign}", got "${storedCallsign ?? "<empty>"}".`
    );
  }
}