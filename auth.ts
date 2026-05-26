import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
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
  pages: {
    signIn: "/login"
  }
});
