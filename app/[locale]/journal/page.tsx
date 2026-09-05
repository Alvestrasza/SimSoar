import Image from "next/image";
import {redirect} from "next/navigation";
import {setRequestLocale} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getJournalOwner, getJournalTimeline} from "@/lib/journal-timeline";
import {journalErrorMessage, journalMessages} from "@/lib/journal-messages";
import {parseJournalCursor} from "@/lib/journal-policy";
import styles from "./journal.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function JournalPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{before?: string; saved?: string; deleted?: string; error?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  if (!await getJournalOwner()) redirect(`/${locale}/login`);
  const t = journalMessages(locale);
  let cursor = null;
  let invalidCursor = false;
  try { cursor = parseJournalCursor(query.before); } catch { invalidCursor = true; }
  const {items, entries, nextCursor} = await getJournalTimeline(cursor);
  const imageMap = new Map(entries.map((entry) => [entry.id, entry.images]));
  const date = new Intl.DateTimeFormat(locale, {dateStyle: "long", timeZone: "UTC"});
  const time = new Intl.DateTimeFormat(locale, {timeStyle: "short", timeZone: "UTC"});
  return <main className={`wrap ${styles.journal}`}>
    <header className={styles.header}><div><span className={styles.privacy}>{t.privacy}</span><h1>{t.title}</h1><p className="muted">{t.subtitle}</p></div><Link className="btn btnPrimary" href="/journal/new">{t.newEntry}</Link></header>
    {query.saved === "1" ? <p className="successBox" role="status">{t.saved}</p> : null}
    {query.deleted === "1" ? <p className="successBox" role="status">{t.deleted}</p> : null}
    {query.error ? <p className="errorBox" role="alert">{journalErrorMessage(locale, query.error)}</p> : null}
    {invalidCursor ? <p className="muted" role="status">{t.invalidCursor}</p> : null}
    <details className={styles.history}><summary>{t.historyTitle}</summary><p>{t.history}</p></details>
    <section aria-label={t.timeline}>
      {items.length === 0 ? <div className={`card ${styles.empty}`}><p>{t.empty}</p><Link className="btn btnSecondary" href="/upload">{t.upload}</Link></div> : <ol className={styles.timeline}>{items.map((item, index) => {
        const entryId = item.kind === "entry" ? item.key.slice(6) : null;
        const images = entryId ? imageMap.get(entryId) ?? [] : [];
        const startsDate = index === 0 || item.happenedAt.toISOString().slice(0, 10) !== items[index - 1].happenedAt.toISOString().slice(0, 10);
        return <li key={item.key} className={styles.timelineItem}>
          {startsDate ? <h2 className={styles.day}>{date.format(item.happenedAt)}</h2> : null}
          <article className={`${styles.activity} ${entryId ? styles.manual : ""}`}>
            <div className={styles.activityHead}><span className={styles.kind}>{t.kinds[item.kind]}</span>{entryId ? <Link href={`/journal/${entryId}/edit`}>{t.editEntry}</Link> : <time dateTime={item.happenedAt.toISOString()}>{time.format(item.happenedAt)} {t.utc}</time>}</div>
            <h3>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h3>
            {item.body ? <p className={styles.body}>{item.body}</p> : null}
            {images.length ? <div className={styles.photos}>{images.map((image) => <a key={image.id} href={`/${locale}/journal/images/${image.id}`} target="_blank" rel="noreferrer"><Image src={`/${locale}/journal/images/${image.id}`} alt={t.photo} width={image.width} height={image.height} unoptimized /></a>)}</div> : null}
          </article>
        </li>;
      })}</ol>}
    </section>
    <nav className={styles.pagination} aria-label={t.timeline}>{cursor ? <Link className="btn btnSecondary" href="/journal">{t.latest}</Link> : <span />}{nextCursor ? <Link className="btn btnSecondary" href={`/journal?before=${nextCursor}`}>{t.older}</Link> : null}</nav>
  </main>;
}
