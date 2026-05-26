import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

type KeycloakProfileWithCallsign = {
  simsoar_callsign?: unknown;
  preferred_username?: unknown;
};

function readStringClaim(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function getSimSoarCallsign(profile: unknown): string | null {
  const keycloakProfile = profile as KeycloakProfileWithCallsign | null;

  const rawCallsign = readStringClaim(keycloakProfile?.simsoar_callsign);
  if (!rawCallsign) return null;

  const callsign = rawCallsign.trim();

  if (!/^[A-Za-z0-9_-]{3,32}$/.test(callsign)) {
    return null;
  }

  return callsign;
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;

        const profile = await prisma.pilotProfile.findUnique({
          where: { userId: user.id },
          select: { callsign: true }
        });

        session.user.callsign = profile?.callsign ?? null;
      }

      return session;
    }
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "keycloak") return;
      if (!user.id) return;

      const callsign = getSimSoarCallsign(profile);
      if (!callsign) return;

      await prisma.pilotProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          callsign
        },
        update: {
          callsign
        }
      });
    }
  },
  pages: {
    signIn: "/login"
  }
});
