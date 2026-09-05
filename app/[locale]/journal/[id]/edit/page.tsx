import {notFound, redirect} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getJournalOwner} from "@/lib/journal-timeline";
import {journalMessages} from "@/lib/journal-messages";
import JournalEntryForm from "../../JournalEntryForm";
import {deleteJournalEntryAction} from "../../actions";
import styles from "../../journal.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditJournalEntryPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const owner = await getJournalOwner();
  if (!owner) redirect(`/${locale}/login`);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) notFound();
  const entry = await prisma.journalEntry.findFirst({where: {id, userId: owner.id}, select: {id: true, version: true, title: true, body: true, occurredAt: true, images: {orderBy: [{createdAt: "asc"}, {id: "asc"}], select: {id: true, width: true, height: true}}}});
  if (!entry) notFound();
  const t = journalMessages(locale);
  return <main className={`wrap ${styles.journal}`}><Link href="/journal">← {t.back}</Link><header className={styles.header}><div><span className={styles.privacy}>{t.privacy}</span><h1>{t.editEntry}</h1></div></header><section className={`card ${styles.formCard}`}><JournalEntryForm locale={locale} entry={{id: entry.id, version: entry.version, title: entry.title, body: entry.body, date: entry.occurredAt.toISOString().slice(0, 10), images: entry.images}} today={new Date().toISOString().slice(0, 10)} /></section>
    <details className={styles.deleteSection}><summary>{t.deleteEntry}</summary><p className="muted">{t.deleteHelp}</p><form action={deleteJournalEntryAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={entry.id} /><input type="hidden" name="version" value={entry.version} /><label><input type="checkbox" name="confirmDelete" value="yes" required /> {t.confirmDelete}</label><button className="btn btnSecondary" type="submit">{t.deleteEntry}</button></form></details>
  </main>;
}
