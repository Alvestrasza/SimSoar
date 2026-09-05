"use client";

import {useActionState, useState} from "react";
import Image from "next/image";
import {Link} from "@/i18n/navigation";
import {journalErrorMessage, journalMessages} from "@/lib/journal-messages";
import {saveJournalEntryAction} from "./actions";
import styles from "./journal.module.css";

type Entry = {id: string; version: number; title: string; body: string; date: string; images: Array<{id: string; width: number; height: number}>};

export default function JournalEntryForm({locale, entry, today}: {locale: string; entry?: Entry; today: string}) {
  const t = journalMessages(locale);
  const [state, action, pending] = useActionState(saveJournalEntryAction, {error: null});
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  return <form action={action} className={styles.editor}>
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="id" value={entry?.id ?? ""} />
    <input type="hidden" name="version" value={entry?.version ?? 0} />
    {state.error ? <p className="errorBox" role="alert">{journalErrorMessage(locale, state.error)}</p> : null}
    <div className={styles.editorTop}>
      <label>{t.entryTitle}<input name="title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>{t.date}<input type="date" name="date" required min="1900-01-01" max={today} value={date} onChange={(event) => setDate(event.target.value)} aria-describedby="journal-date-help" /></label>
    </div>
    <small id="journal-date-help" className="muted">{t.dateHelp}</small>
    <label>{t.body}<textarea name="body" required maxLength={10000} rows={10} value={body} onChange={(event) => setBody(event.target.value)} aria-describedby="journal-body-help" /></label>
    <small id="journal-body-help" className="muted">{t.maxLength}</small>
    {entry?.images.length ? <fieldset className={styles.existingPhotos}><legend>{t.keepPhotos}</legend><div className={styles.photos}>{entry.images.map((image) => <label key={image.id} className={styles.photoChoice}>
      <Image src={`/${locale}/journal/images/${image.id}`} alt={t.photo} width={image.width} height={image.height} unoptimized />
      <span><input type="checkbox" name="removeImageIds" value={image.id} /> {t.removePhoto}</span>
    </label>)}</div></fieldset> : null}
    <label>{t.photos}<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="journal-image-help" /></label>
    <small id="journal-image-help" className="muted">{t.imageHelp}</small>
    <div className={styles.actions}><button className="btn btnPrimary" type="submit" disabled={pending}>{pending ? t.saving : t.save}</button><Link className="btn btnSecondary" href="/journal">{t.cancel}</Link></div>
  </form>;
}
