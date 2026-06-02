import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import {
  extractKeycloakRoleValues,
  hasSimSoarEnvironmentAccess,
  normalizeSimSoarRoles
} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

type KeycloakProfileWithCallsign = {
  simsoar_callsign?: unknown;
  preferred_username?: unknown;
};

function readStringClaim(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function normalizeCallsignCandidate(value: string | null): string | null {
  if (!value) return null;

  const callsign = value.trim();

  if (!/^[A-Za-z0-9_-]{3,32}$/.test(callsign)) {
    return null;
  }

  return callsign;
}

function getInitialSimSoarCallsign(profile: unknown): string | null {
  const keycloakProfile = profile as KeycloakProfileWithCallsign | null;

  return (
    normalizeCallsignCandidate(readStringClaim(keycloakProfile?.simsoar_callsign)) ??
    normalizeCallsignCandidate(readStringClaim(keycloakProfile?.preferred_username))
  );
}
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      callsign?: string | null;
      image?: string | null;
      roles?: string[];
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!
    })
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "keycloak") {
        return true;
      }

      const roleValues = extractKeycloakRoleValues(
        profile,
        process.env.AUTH_KEYCLOAK_ID
      );

      if (!hasSimSoarEnvironmentAccess(roleValues)) {
        console.warn("SimSoar sign-in denied because the user is not assigned to an environment-specific access group.", {
          environment:
            process.env.SIMSOAR_ENV ??
            process.env.NEXT_PUBLIC_SIMSOAR_ENV ??
            null,
          provider: account.provider,
          rawRoleValues: roleValues
        });

        return false;
      }

      return true;
    },
    async session({ session, user }) {
    if (session.user) {
      session.user.id = user.id;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          roles: true,
          profile: {
            select: {
              callsign: true
            }
          }
        }
      });

      session.user.callsign = dbUser?.profile?.callsign ?? null;
      session.user.roles = dbUser?.roles ?? ["USER"];
    }

    return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;

      const target = new URL(url);

      if (target.origin === new URL(baseUrl).origin) {
        return url;
      }

      const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
      if (issuer) {
        const issuerUrl = new URL(issuer);
        const issuerPath = issuerUrl.pathname.replace(/\/$/, "");
        const expectedLogoutPath = `${issuerPath}/protocol/openid-connect/logout`;

        if (
          target.origin === issuerUrl.origin &&
          target.pathname === expectedLogoutPath
        ) {
          return url;
        }
      }

      return baseUrl;
    }
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "keycloak") return;
      if (!user.id) return;

      const roleValues = extractKeycloakRoleValues(
        profile,
        process.env.AUTH_KEYCLOAK_ID
      );

      /*
       * Keycloak / AD is the authoritative source for SimSoar role membership.
       * SimSoar mirrors the resolved roles into the local database during sign-in.
       */
      const roles = new Set(normalizeSimSoarRoles(roleValues));

      const bootstrapAdminEmails = (process.env.SIMSOAR_BOOTSTRAP_ADMIN_EMAILS ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      const userEmail = user.email?.toLowerCase() ?? null;

      if (userEmail && bootstrapAdminEmails.includes(userEmail)) {
        roles.add("ADMIN");
      }

      const finalRoles = normalizeSimSoarRoles([...roles]);

      await prisma.user.update({
        where: { id: user.id },
        data: { roles: finalRoles }
      });

      await writeAuditLog({
        actorUserId: user.id,
        actorEmail: user.email,
        action: "USER_ROLE_SYNC",
        targetType: "User",
        targetId: user.id,
        summary: "User roles synchronized from Keycloak during sign-in.",
        metadata: {
          provider: account.provider,
          roles: finalRoles,
          rawRoleValues: roleValues
        }
      });

      const existingProfile = await prisma.pilotProfile.findUnique({
        where: {
          userId: user.id
        },
        select: {
          id: true,
          callsign: true
        }
      });

      /*
      * Keycloak may provide an initial callsign during registration.
      * After the SimSoar profile exists, the callsign is edited through SimSoar
      * and written back to Keycloak through the profile save action.
      */
      if (!existingProfile) {
        const initialCallsign = getInitialSimSoarCallsign(profile);

        if (initialCallsign) {
          await prisma.pilotProfile.create({
            data: {
              userId: user.id,
              callsign: initialCallsign
            }
          });
        }
      }
    }
  },
  pages: {
    signIn: "/login"
  }
});
