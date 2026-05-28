"use server";

import {auth, signIn, signOut} from "@/auth";
import {prisma} from "@/lib/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getLocaleFromFormData(formData?: FormData): "de" | "en" {
  const value = formData?.get("locale");
  return value === "en" ? "en" : "de";
}

function buildKeycloakLogoutUrl(locale: "de" | "en", idToken?: string | null): string {
  const issuer = requiredEnv("AUTH_KEYCLOAK_ISSUER").replace(/\/$/, "");
  const clientId = requiredEnv("AUTH_KEYCLOAK_ID");
  const appUrl = requiredEnv("AUTH_URL").replace(/\/$/, "");

  const logoutUrl = new URL(`${issuer}/protocol/openid-connect/logout`);

  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${appUrl}/${locale}`);

  // OIDC-konform
  logoutUrl.searchParams.set("ui_locales", locale);

  // Keycloak-spezifisch, wichtig für Theme-/Cookie-Locale
  logoutUrl.searchParams.set("kc_locale", locale);

  if (idToken) {
    logoutUrl.searchParams.set("id_token_hint", idToken);
  }

  return logoutUrl.toString();
}

export async function signInWithKeycloak(formData?: FormData) {
  const locale = getLocaleFromFormData(formData);

  await signIn(
    "keycloak",
    {
      redirectTo: `/${locale}`
    },
    {
      ui_locales: locale,
      kc_locale: locale
    }
  );
}

export async function signOutWithKeycloak(formData?: FormData) {
  const locale = getLocaleFromFormData(formData);
  const session = await auth();

  let redirectTo = `/${locale}`;

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

    redirectTo = buildKeycloakLogoutUrl(locale, account?.id_token);
  }

  await signOut({redirectTo});
}