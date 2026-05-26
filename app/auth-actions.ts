"use server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildKeycloakLogoutUrl(idToken?: string | null): string {
  const issuer = requiredEnv("AUTH_KEYCLOAK_ISSUER").replace(/\/$/, "");
  const clientId = requiredEnv("AUTH_KEYCLOAK_ID");
  const appUrl = requiredEnv("AUTH_URL").replace(/\/$/, "");

  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);

  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${appUrl}/`);

  if (idToken) {
    logoutUrl.searchParams.set("id_token_hint", idToken);
  }

  return logoutUrl.toString();
}

export async function signInWithKeycloak() {
  await signIn("keycloak", { redirectTo: "/" });
}

export async function signOutWithKeycloak() {
  const session = await auth();

  let redirectTo = "/";

  if (session?.user?.id) {
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "keycloak"
      },
      select: {
        id_token: true
      }
    });

    redirectTo = buildKeycloakLogoutUrl(account?.id_token);
  }

  await signOut({ redirectTo });
}