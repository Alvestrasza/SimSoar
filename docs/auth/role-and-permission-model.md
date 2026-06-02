<!--
Document: SimSoar Role and Permission Model
Version: 0.1.0
Created: 2026-06-02
Last-Modified: 2026-06-02
Status: Draft for v0.3.0
Maintainer: SimSoar Project Team
-->

# SimSoar Role and Permission Model

## 1. Purpose

This document describes the SimSoar role and permission model for milestone `Features for v0.3.0`.

The goal is to keep user identity and role membership centrally managed through Keycloak and Active Directory, while allowing SimSoar administrators to manage application roles directly from within the SimSoar admin interface.

## 2. Authority Model

SimSoar follows this authority chain:

```text
Active Directory groups
  ↓
Keycloak LDAP group mapper
  ↓
Keycloak group and role claims
  ↓
SimSoar sign-in role synchronization
  ↓
SimSoar local database mirror
```

For role changes, the flow is reversed through the SimSoar admin interface:

```text
SimSoar Admin UI
  ↓
Keycloak Admin API
  ↓
Keycloak LDAP group membership update
  ↓
Active Directory group membership
  ↓
SimSoar role mirror after update / next sign-in
```

Keycloak and Active Directory are the authoritative source for role membership. SimSoar stores a local role mirror for fast access control checks and user interface rendering.

## 3. Environments

SimSoar role group membership is environment-specific.

The application determines the active environment through one of the following environment variables:

```text
SIMSOAR_ENV=dev|prod
NEXT_PUBLIC_SIMSOAR_ENV=dev|prod
```

The active environment controls which Keycloak / Active Directory groups are evaluated and updated.

Examples:

```text
DEV  → SimSoar_DEV_Users
PROD → SimSoar_PROD_Users
```

This prevents PROD role groups from granting DEV permissions and prevents DEV role groups from granting PROD permissions.

## 4. Keycloak / Active Directory Groups

The following group model is used.

### 4.1 DEV Groups

| SimSoar Role | Keycloak / AD Group |
|---|---|
| USER | `SimSoar_DEV_Users` |
| PILOT | `SimSoar_DEV_Pilots` |
| MODERATOR | `SimSoar_DEV_Moderators` |
| ADMIN | `SimSoar_DEV_Admins` |
| OWNER | `SimSoar_DEV_Owners` |

### 4.2 PROD Groups

| SimSoar Role | Keycloak / AD Group |
|---|---|
| USER | `SimSoar_PROD_Users` |
| PILOT | `SimSoar_PROD_Pilots` |
| MODERATOR | `SimSoar_PROD_Moderators` |
| ADMIN | `SimSoar_PROD_Admins` |
| OWNER | `SimSoar_PROD_Owners` |

The group prefix can be configured through:

```text
KEYCLOAK_SIMSOAR_GROUP_PREFIX=SimSoar
```

If not set, SimSoar uses the default prefix above.

## 5. SimSoar Roles

SimSoar currently uses the following application roles:

| Role | Purpose |
|---|---|
| USER | Base application access. This role must always remain assigned. |
| PILOT | Allows pilot functionality, including flight uploads. |
| MODERATOR | Allows moderation of uploaded flights and selected content. |
| ADMIN | Allows administrative access, including user management and audit log access. |
| OWNER | Highest application role. Allows management of ADMIN and OWNER assignments. |

## 6. Role Hierarchy

Roles are evaluated in the following order:

```text
USER → PILOT → MODERATOR → ADMIN → OWNER
```

Higher roles imply access to lower-level application areas where appropriate. For example, an ADMIN can access moderation functions if the application checks for MODERATOR-level access through the role hierarchy.

The highest assigned role is displayed on the user's profile page as a compact status badge.

## 7. New User Onboarding

New users register through Keycloak.

The expected registration flow is:

```text
User
  ↓
SimSoar sign-up link
  ↓
Keycloak registration
  ↓
Keycloak default groups
  ↓
Active Directory group membership
  ↓
SimSoar first sign-in
```

For normal self-service onboarding, Keycloak default groups should include at least:

```text
SimSoar_DEV_Users
SimSoar_DEV_Pilots
```

For PROD, default group assignment must be reviewed separately before public production use.

## 8. Sign-In Role Synchronization

During sign-in, SimSoar reads role values from the Keycloak profile / token claims and normalizes them into internal SimSoar roles.

Supported role sources include:

```text
simsoar_user
simsoar_pilot
simsoar_moderator
simsoar_admin
simsoar_owner
```

and environment-specific group names such as:

```text
SimSoar_DEV_Users
SimSoar_DEV_Pilots
SimSoar_DEV_Moderators
SimSoar_DEV_Admins
SimSoar_DEV_Owners
```

Only role groups matching the active SimSoar environment are considered.

After successful sign-in, SimSoar mirrors the resolved roles into the local `User.roles` database field.

## 9. Role Management in SimSoar

Application role changes are performed in the SimSoar admin interface.

The role update flow is:

```text
Admin changes roles in SimSoar
  ↓
SimSoar updates Keycloak group membership through the Keycloak Admin API
  ↓
Keycloak writes group membership to Active Directory through the LDAP group mapper
  ↓
SimSoar updates the local User.roles mirror
  ↓
Audit log entry is written
```

Keycloak is updated before the local SimSoar database mirror is changed. This prevents SimSoar from storing role assignments that were not successfully written to the central identity system.

## 10. Role Management Rules

The following rules are enforced:

- `USER` is mandatory and must always remain assigned.
- Normal admins may manage `PILOT` and `MODERATOR` assignments.
- `OWNER` is required to assign or remove `ADMIN` and `OWNER` roles.
- Administrators cannot remove their own administrator access by accident.
- Role changes are written to Keycloak first and then mirrored locally.
- Role changes are written to the audit log.

## 11. Upload Permission Enforcement

Flight uploads require the `PILOT` role.

This is enforced in two places:

1. Upload page rendering
2. Server-side upload action

A user without `PILOT` can still sign in, use SimSoar, view public flights and access the profile page, but cannot upload new flights.

The user interface shows a friendly message instead of the upload form:

```text
You are on this website, but we do not grant you the rank of pilot.
```

The server action also rejects direct upload attempts without `PILOT` role.

## 12. Admin and Moderation Access

Admin and moderation areas must be protected both in the user interface and on the server side.

Expected access model:

| Area | Required Role |
|---|---|
| Flight upload | PILOT |
| Flight moderation | MODERATOR |
| Admin dashboard | MODERATOR |
| User administration | ADMIN |
| Audit log | ADMIN |
| Admin / Owner role assignment | OWNER |

Frontend visibility is only a usability feature. Server-side permission checks are mandatory.

## 13. Callsign Synchronization

The SimSoar callsign is managed through the SimSoar profile page but is written back to Keycloak.

The synchronization flow is:

```text
SimSoar profile save
  ↓
Keycloak user attribute update
  ↓
LDAP user attribute mapper
  ↓
Active Directory attribute
  ↓
SimSoar local profile update
```

The Keycloak user model attribute is:

```text
simsoar_callsign
```

The LDAP mapper currently writes this to an Active Directory extension attribute, such as:

```text
msDS-cloudExtensionAttribute10
```

The exact LDAP attribute is configured in Keycloak and is not hardcoded in SimSoar.

## 14. Keycloak Admin API Requirements

The SimSoar service account used for Keycloak administration requires permissions to:

- Read users
- Manage users
- Read groups
- Update user group membership

Minimum expected Keycloak service account roles under `realm-management`:

```text
view-users
manage-users
query-groups
view-realm
```

Depending on the Keycloak version and mapper configuration, additional permissions may be required.

## 15. Relevant Environment Variables

| Variable | Purpose |
|---|---|
| `AUTH_KEYCLOAK_ISSUER` | Public OIDC issuer used for authentication. |
| `AUTH_KEYCLOAK_ID` | Keycloak client id used by Auth.js. |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Service account client id for Keycloak Admin API access. |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Service account secret for Keycloak Admin API access. |
| `KEYCLOAK_ADMIN_REALM_URL` | Internal Keycloak Admin API realm URL. Recommended for server-to-server access. |
| `KEYCLOAK_SIMSOAR_GROUP_PREFIX` | Prefix for SimSoar role groups. |
| `KEYCLOAK_CALLSIGN_ATTRIBUTE` | Keycloak user attribute for the SimSoar callsign. Defaults to `simsoar_callsign`. |
| `SIMSOAR_ENV` | Server-side environment name: `dev` or `prod`. |
| `NEXT_PUBLIC_SIMSOAR_ENV` | Public environment name used for UI display and fallback. |

## 16. Operational Notes

- Prefer internal Keycloak admin URLs for server-to-server communication from SimSoar to Keycloak.
- Avoid public hairpin paths for Keycloak Admin API access where possible.
- Ensure load balancer and firewall timeouts do not break long-running application database pools.
- For PostgreSQL connections, use reasonable Prisma connection limits and idle lifetime settings.
- Keep Keycloak LDAP group mappers filtered to SimSoar groups only.
- Do not allow SimSoar to write arbitrary AD data directly. All identity-related changes should go through Keycloak.

## 17. Test Matrix

Before closing role-related changes, verify the following scenarios:

| Test Case | Expected Result |
|---|---|
| New user registration | User receives environment-specific `Users` and `Pilots` groups through Keycloak default groups. |
| New user first sign-in | SimSoar mirrors `USER` and `PILOT`. |
| Remove PILOT in SimSoar | User is removed from the environment-specific `Pilots` group in Keycloak / AD. |
| User without PILOT opens upload page | Upload form is hidden and a friendly message is shown. |
| User without PILOT submits direct upload request | Server action rejects the upload. |
| Re-add PILOT in SimSoar | User is added back to the environment-specific `Pilots` group in Keycloak / AD. |
| Moderator access | MODERATOR can access moderation functions. |
| Admin access | ADMIN can access user administration and audit log. |
| Owner access | OWNER can manage ADMIN and OWNER assignments. |
| Logout / Login after role change | SimSoar mirrors the role state from Keycloak and does not restore removed roles unless Keycloak still contains them. |

## 18. Current Scope for v0.3.0

For milestone `Features for v0.3.0`, this model covers:

- Keycloak / AD-based role source of truth
- Role synchronization during sign-in
- Role changes through SimSoar admin UI
- Keycloak group update from SimSoar
- AD synchronization through Keycloak LDAP mapping
- Upload protection through the PILOT role
- Admin and moderation access control
- Audit logging for role changes
- Profile display of the user's highest role

Future improvements may include a dedicated role management history view, improved user-facing error messages for failed Keycloak updates, and automated consistency checks between SimSoar, Keycloak and AD.
