import assert from "node:assert/strict";
import test from "node:test";
import {
  extractKeycloakRoleValues,
  hasSimSoarEnvironmentAccess,
  normalizeSimSoarRoles
} from "../lib/rbac.ts";

function withIdentityEnvironment(environment, callback) {
  const previousEnvironment = process.env.SIMSOAR_ENV;
  const previousPublicEnvironment = process.env.NEXT_PUBLIC_SIMSOAR_ENV;
  const previousPrefix = process.env.KEYCLOAK_SIMSOAR_GROUP_PREFIX;

  if (environment === undefined) delete process.env.SIMSOAR_ENV;
  else process.env.SIMSOAR_ENV = environment;
  delete process.env.NEXT_PUBLIC_SIMSOAR_ENV;
  process.env.KEYCLOAK_SIMSOAR_GROUP_PREFIX = "SimSoar";

  try {
    callback();
  } finally {
    if (previousEnvironment === undefined) delete process.env.SIMSOAR_ENV;
    else process.env.SIMSOAR_ENV = previousEnvironment;
    if (previousPublicEnvironment === undefined) delete process.env.NEXT_PUBLIC_SIMSOAR_ENV;
    else process.env.NEXT_PUBLIC_SIMSOAR_ENV = previousPublicEnvironment;
    if (previousPrefix === undefined) delete process.env.KEYCLOAK_SIMSOAR_GROUP_PREFIX;
    else process.env.KEYCLOAK_SIMSOAR_GROUP_PREFIX = previousPrefix;
  }
}

test("accepts only exact groups for the active environment", () => {
  withIdentityEnvironment("dev", () => {
    assert.equal(hasSimSoarEnvironmentAccess(["/SimSoar_DEV_Users"]), true);
    assert.equal(hasSimSoarEnvironmentAccess(["SimSoar_PROD_Admins"]), false);
    assert.equal(hasSimSoarEnvironmentAccess(["unrelated_simsoar_dev_users"]), false);
  });
});

test("fails closed when the runtime environment is missing", () => {
  withIdentityEnvironment(undefined, () => {
    assert.equal(hasSimSoarEnvironmentAccess(["SimSoar_DEV_Users"]), false);
  });
});

test("maps exact active-environment groups without cross-environment privileges", () => {
  withIdentityEnvironment("dev", () => {
    assert.deepEqual(
      normalizeSimSoarRoles(["SimSoar_DEV_Pilots", "SimSoar_PROD_Owners", "unrelated_simsoar_dev_admin"]),
      ["USER", "PILOT"]
    );
  });
});

test("extracts groups and allowlisted client roles but ignores generic and realm roles", () => {
  const values = extractKeycloakRoleValues({
    simsoar_roles: ["simsoar_owner"],
    realm_access: {roles: ["ADMIN", "simsoar_admin"]},
    groups: ["SimSoar_DEV_Users"],
    resource_access: {
      simsoar: {roles: ["ADMIN", "simsoar_moderator"]},
      another_client: {roles: ["simsoar_owner"]}
    }
  }, "simsoar");

  assert.deepEqual(values, ["SimSoar_DEV_Users", "simsoar_moderator"]);
});

test("keeps canonical internal database roles functional", () => {
  assert.deepEqual(normalizeSimSoarRoles(["ADMIN"]), ["USER", "ADMIN"]);
});
