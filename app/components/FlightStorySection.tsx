import {getTranslations} from "next-intl/server";
import {deleteFlightStoryImageAction, updateFlightStoryAction} from "@/app/[locale]/flights/[id]/story-actions";
import {getStoryImageLimits} from "@/lib/flight-story";

type StoryImage = {id: string; fileName: string};

export default async function FlightStorySection({
  locale,
  flightId,
  storyText,
  images,
  canEdit,
  canRemove
}: {
  locale: string;
  flightId: string;
  storyText: string | null;
  images: StoryImage[];
  canEdit: boolean;
  canRemove: boolean;
}) {
  const t = await getTranslations({locale, namespace: "FlightStory"});
  const limits = getStoryImageLimits();
  if (!storyText && images.length === 0 && !canEdit) return null;

  return <section className="card flightStoryCard">
    <div className="cardHead"><span className="cardTitle">{t("title")}</span></div>
    <div className="cardBody">
      {storyText ? <p className="flightStoryText">{storyText}</p> : <p className="muted">{t("empty")}</p>}
      {images.length > 0 ? <div className="flightStoryGallery">
        {images.map((image) => <figure key={image.id}>
          <img src={`/${locale}/flights/${flightId}/images/${image.id}`} alt={image.fileName} loading="lazy" />
          <figcaption>{image.fileName}</figcaption>
          {canRemove ? <form action={deleteFlightStoryImageAction}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="flightId" value={flightId} /><input type="hidden" name="imageId" value={image.id} />
            <button className="btn btnDanger" type="submit">{t("removeImage")}</button>
          </form> : null}
        </figure>)}
      </div> : null}

      {canEdit ? <form action={updateFlightStoryAction} encType="multipart/form-data" className="flightStoryForm">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="flightId" value={flightId} />
        <label><span>{t("storyText")}</span><textarea name="storyText" defaultValue={storyText ?? ""} maxLength={5000} /></label>
        <label><span>{t("images")}</span><input type="file" name="storyImages" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple /></label>
        <p className="muted">{t("limits", {count: limits.maxImagesPerFlight, megabytes: Math.round(limits.maxFileBytes / 1024 / 1024)})}</p>
        <button className="btn btnSuccess" type="submit">{t("save")}</button>
      </form> : null}
    </div>
  </section>;
}
