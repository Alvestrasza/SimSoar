import {notFound, redirect} from "next/navigation";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {SIMSOAR_OAUTH_SCOPES} from "@/lib/oauth-policy";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {saveOAuthClientAction} from "./actions";

export const dynamic = "force-dynamic";

export default async function OAuthClientsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const [session, t] = await Promise.all([auth(), getTranslations({locale, namespace: "AdminOAuth"})]);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  if (!hasRole(session.user.roles, "ADMIN")) notFound();
  const clients = await prisma.oAuthClient.findMany({orderBy: [{status: "asc"}, {name: "asc"}], include: {_count: {select: {grants: true}}}});
  const fields = (client?: typeof clients[number]) => <>
    <input type="hidden" name="locale" value={locale} />{client ? <input type="hidden" name="recordId" value={client.id} /> : null}
    <label><span>{t("clientId")}</span><input name="clientId" required readOnly={Boolean(client)} minLength={3} maxLength={160} defaultValue={client?.clientId} /></label>
    <label><span>{t("name")}</span><input name="name" required minLength={2} maxLength={120} defaultValue={client?.name} /></label>
    <label className="full"><span>{t("description")}</span><textarea name="description" maxLength={2000} defaultValue={client?.description ?? ""} /></label>
    <label className="full"><span>{t("redirectUris")}</span><textarea name="redirectUris" required defaultValue={client?.redirectUris.join("\n") ?? ""} /><small className="muted">{t("redirectHint")}</small></label>
    <fieldset className="full"><legend>{t("scopes")}</legend><div className="formGrid">{SIMSOAR_OAUTH_SCOPES.map((scope) => <label key={scope}><input type="checkbox" name="scopes" value={scope} defaultChecked={client?.allowedScopes.includes(scope)} /> {scope}</label>)}</div></fieldset>
    <label><span>{t("status")}</span><select name="status" defaultValue={client?.status ?? "PENDING"}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="SUSPENDED">SUSPENDED</option><option value="REVOKED">REVOKED</option></select></label>
    <label><input type="checkbox" name="consentRequired" value="true" required defaultChecked={client?.consentRequired ?? true} /> {t("consentRequired")}</label>
  </>;
  return <main className="wrap adminWrap"><section className="card"><div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div><Link className="btn btnSecondary" href="/admin">{t("back")}</Link></div><div className="cardBody">{query.saved ? <p className="badge">{t("saved")}</p> : null}{query.error ? <p className="errorBox">{t("invalid")}</p> : null}<form action={saveOAuthClientAction} className="formGrid">{fields()}<button className="btn btnPrimary" type="submit">{t("register")}</button></form></div></section>
    <section className="card" style={{marginTop: 20}}><div className="cardHead"><span className="cardTitle">{t("registered")}</span></div><div className="cardBody moderationCardGrid">{clients.length ? clients.map((client) => <article className="moderationCard" key={client.id}><div><strong>{client.name}</strong><p className="muted">{client.clientId} · {client.status} · {t("grants", {count: client._count.grants})}</p></div><form action={saveOAuthClientAction} className="formGrid">{fields(client)}<button className="btn btnSecondary" type="submit">{t("save")}</button></form></article>) : <p className="muted">{t("empty")}</p>}</div></section></main>;
}
