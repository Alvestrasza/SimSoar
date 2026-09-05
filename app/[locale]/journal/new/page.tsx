import {redirect} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getJournalOwner} from "@/lib/journal-timeline";
import {journalMessages} from "@/lib/journal-messages";
import JournalEntryForm from "../JournalEntryForm";
import styles from "../journal.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewJournalEntryPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  if (!await getJournalOwner()) redirect(`/${locale}/login`);
  const t = journalMessages(locale);
  return <main className={`wrap ${styles.journal}`}><Link href="/journal">← {t.back}</Link><header className={styles.header}><div><span className={styles.privacy}>{t.privacy}</span><h1>{t.newEntry}</h1></div></header><section className={`card ${styles.formCard}`}><JournalEntryForm locale={locale} today={new Date().toISOString().slice(0, 10)} /></section></main>;
}
