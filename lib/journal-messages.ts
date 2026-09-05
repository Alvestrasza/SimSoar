import type {JournalKind} from "./journal-policy.ts";

const en = {
  title: "Pilot journal", subtitle: "Your flights, activities and memories in one personal timeline.",
  privacy: "Private · visible only to you", newEntry: "Write an entry", editEntry: "Edit entry", timeline: "Activity timeline",
  historyTitle: "About your activity history", history: "The timeline brings together your saved flights, tasks, club memberships, competition and league entries, follows, badges, comments, likes, waypoint imports and segment results. Flight events show the upload date. Deleted records and earlier changes cannot be reconstructed; this is not a complete audit history.",
  empty: "Your next flight is the start of a new story. Write your first entry or upload a flight.", upload: "Upload a flight", older: "Older activities", latest: "Latest activities",
  saved: "Your journal entry has been saved.", deleted: "Your journal entry has been deleted.",
  back: "Back to journal", date: "Date", entryTitle: "Title", body: "Your story", photos: "Add photos", save: "Save entry", saving: "Saving…", cancel: "Cancel",
  imageHelp: "Up to 4 photos per entry, 5 MiB each: JPEG, PNG or WebP. Photos are checked, converted to WebP and stripped of location metadata. Animated images are not supported.",
  photo: "Private journal photo", removePhoto: "Remove this photo", keepPhotos: "Existing photos", deleteEntry: "Delete entry", confirmDelete: "Permanently delete this entry and its photos", deleteHelp: "Automatic activities stay linked to their original records. You can edit or delete your own journal entries here.",
  dateHelp: "Choose today or an earlier date. Entries on the same date use a stable order.", maxLength: "Up to 10,000 characters. Text is shown as written; HTML is not rendered.", utc: "UTC", invalidCursor: "This page link is invalid. The latest activities are shown.",
  errors: {
    rate_limit: "Please wait a minute before changing your journal again.",
    invalid_fields: "Check the title, text and date. Required fields cannot be empty, and the date cannot be in the future.", image_count: "An entry can contain at most 4 photos. Remove a photo before adding another.", image_size: "Each photo must be no larger than 5 MiB.", image_type: "Choose a JPEG, PNG or WebP image with matching file content.", image_dimensions: "Choose a still image with at most 20 megapixels and no side longer than 8,192 pixels.", image_invalid: "One of the photos could not be decoded. Please export it as a new JPEG, PNG or WebP file.", quota: "Your journal storage limit has been reached (5,000 entries or 500 MiB of photos). Remove older content to continue.", not_found: "This entry is no longer available.", conflict: "This entry changed in another session. Reload it before saving again.", save_failed: "Your entry could not be saved. Your text is still here; please try again and select your photos again if needed."
  },
  kinds: {entry: "Journal entry", flight: "Flight uploaded", task: "Task created", club: "Joined a club", competition: "Competition entry", league: "League entry", follow: "Following a pilot", badge: "Badge earned", comment: "Comment posted", like: "Flight liked", cup: "Waypoints imported", segment: "Segment completed"} satisfies Record<JournalKind, string>
};
const de: typeof en = {
  title: "Pilotentagebuch", subtitle: "Deine Flüge, Aktivitäten und Erinnerungen in einer persönlichen Chronik.",
  privacy: "Privat · nur für dich sichtbar", newEntry: "Eintrag schreiben", editEntry: "Eintrag bearbeiten", timeline: "Aktivitäten",
  historyTitle: "Über deinen Aktivitätsverlauf", history: "Hier erscheinen deine gespeicherten Flüge, Aufgaben, Vereinsmitgliedschaften, Wettbewerbs- und Ligaeinträge, abonnierten Piloten, Abzeichen, Kommentare, Likes, Wegpunktimporte und Segmentergebnisse. Bei Flügen zählt das Upload-Datum. Gelöschte Datensätze und frühere Änderungen lassen sich nicht rekonstruieren; dies ist kein vollständiges Änderungsprotokoll.",
  empty: "Mit deinem nächsten Flug beginnt eine neue Geschichte. Schreibe deinen ersten Eintrag oder lade einen Flug hoch.", upload: "Flug hochladen", older: "Ältere Aktivitäten", latest: "Neueste Aktivitäten",
  saved: "Dein Tagebucheintrag wurde gespeichert.", deleted: "Dein Tagebucheintrag wurde gelöscht.",
  back: "Zurück zum Tagebuch", date: "Datum", entryTitle: "Titel", body: "Deine Geschichte", photos: "Bilder hinzufügen", save: "Eintrag speichern", saving: "Wird gespeichert…", cancel: "Abbrechen",
  imageHelp: "Bis zu 4 Bilder pro Eintrag mit je 5 MiB: JPEG, PNG oder WebP. Bilder werden geprüft, in WebP umgewandelt und von Standort-Metadaten befreit. Animierte Bilder werden nicht unterstützt.",
  photo: "Privates Tagebuchbild", removePhoto: "Dieses Bild entfernen", keepPhotos: "Vorhandene Bilder", deleteEntry: "Eintrag löschen", confirmDelete: "Diesen Eintrag und seine Bilder endgültig löschen", deleteHelp: "Automatische Aktivitäten bleiben mit ihren ursprünglichen Datensätzen verknüpft. Deine eigenen Tagebucheinträge kannst du hier bearbeiten oder löschen.",
  dateHelp: "Wähle heute oder ein früheres Datum. Einträge am selben Tag werden in einer festen Reihenfolge angezeigt.", maxLength: "Bis zu 10.000 Zeichen. Der Text wird unverändert angezeigt; HTML wird nicht ausgeführt.", utc: "UTC", invalidCursor: "Dieser Seitenlink ist ungültig. Es werden die neuesten Aktivitäten angezeigt.",
  errors: {
    rate_limit: "Warte bitte eine Minute, bevor du dein Tagebuch erneut änderst.",
    invalid_fields: "Prüfe Titel, Text und Datum. Pflichtfelder dürfen nicht leer sein und das Datum darf nicht in der Zukunft liegen.", image_count: "Ein Eintrag darf höchstens 4 Bilder enthalten. Entferne ein Bild, bevor du ein weiteres hinzufügst.", image_size: "Jedes Bild darf höchstens 5 MiB groß sein.", image_type: "Wähle ein JPEG-, PNG- oder WebP-Bild mit passendem Dateiinhalt.", image_dimensions: "Wähle ein Einzelbild mit höchstens 20 Megapixeln und maximal 8.192 Pixeln pro Seite.", image_invalid: "Eines der Bilder konnte nicht gelesen werden. Exportiere es bitte als neue JPEG-, PNG- oder WebP-Datei.", quota: "Dein Tagebuchlimit ist erreicht (5.000 Einträge oder 500 MiB Bilder). Entferne ältere Inhalte, um fortzufahren.", not_found: "Dieser Eintrag ist nicht mehr verfügbar.", conflict: "Dieser Eintrag wurde in einer anderen Sitzung geändert. Lade ihn vor dem Speichern neu.", save_failed: "Dein Eintrag konnte nicht gespeichert werden. Dein Text ist noch vorhanden; versuche es erneut und wähle die Bilder bei Bedarf nochmals aus."
  },
  kinds: {entry: "Tagebucheintrag", flight: "Flug hochgeladen", task: "Aufgabe erstellt", club: "Verein beigetreten", competition: "Wettbewerbsteilnahme", league: "Ligaeintrag", follow: "Pilot abonniert", badge: "Abzeichen erhalten", comment: "Kommentar geschrieben", like: "Flug gelikt", cup: "Wegpunkte importiert", segment: "Segment abgeschlossen"}
};

export function journalMessages(locale: string) { return locale === "en" ? en : de; }
export function journalErrorMessage(locale: string, code: string) {
  const messages = journalMessages(locale);
  return Object.hasOwn(messages.errors, code) ? messages.errors[code as keyof typeof messages.errors] : messages.errors.save_failed;
}
