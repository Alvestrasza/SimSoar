"use client";

import {useParams, usePathname} from "next/navigation";
import {useTranslations} from "next-intl";
import {
  deleteFlightAction,
  setFlightVisibilityAction
} from "@/app/[locale]/profile/flight-actions";

type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

type Props = {
  flightId: string;
  visibility: Visibility;
  canChangeVisibility?: boolean;
  canDelete?: boolean;
};

export default function FlightOwnerActions({
  flightId,
  visibility,
  canChangeVisibility = true,
  canDelete = true
}: Props) {
  const t = useTranslations("FlightOwnerActions");
  const params = useParams<{locale?: string}>();
  const pathname = usePathname();

  const locale = params.locale === "en" ? "en" : "de";
  const currentPath = pathname || `/${locale}/profile`;

  if (!canChangeVisibility && !canDelete) {
    return null;
  }

  return (
    <div className="ownerActions">
      {canChangeVisibility ? (
        <form action={setFlightVisibilityAction}>
          <input type="hidden" name="flightId" value={flightId} />
          <input type="hidden" name="returnTo" value={currentPath} />

          <label className="srOnly" htmlFor={`visibility-${flightId}`}>
            {t("visibilityLabel")}
          </label>

          <select
            id={`visibility-${flightId}`}
            name="visibility"
            defaultValue={visibility}
            aria-label={t("visibilityLabel")}
          >
            <option value="PUBLIC">{t("visibilityPublic")}</option>
            <option value="UNLISTED">{t("visibilityUnlisted")}</option>
            <option value="PRIVATE">{t("visibilityPrivate")}</option>
          </select>

          <button className="btn btnSecondary" type="submit">
            {t("saveVisibility")}
          </button>
        </form>
      ) : null}

      {canDelete ? (
        <form
          action={deleteFlightAction}
          onSubmit={(event) => {
            const ok = window.confirm(t("deleteConfirm"));

            if (!ok) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="flightId" value={flightId} />
          <input type="hidden" name="returnTo" value={`/${locale}/profile`} />

          <button className="btn btnDanger" type="submit">
            {t("delete")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
