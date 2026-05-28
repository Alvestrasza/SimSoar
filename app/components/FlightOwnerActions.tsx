"use client";

import {useParams, usePathname} from "next/navigation";
import {
  deleteFlightAction,
  setFlightVisibilityAction
} from "@/app/[locale]/profile/flight-actions";

type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

type Props = {
  flightId: string;
  visibility: Visibility;
};

export default function FlightOwnerActions({flightId, visibility}: Props) {
  const params = useParams<{locale?: string}>();
  const pathname = usePathname();

  const locale = params.locale === "en" ? "en" : "de";
  const currentPath = pathname || `/${locale}/profile`;

  const nextVisibility = visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
  const visibilityLabel =
    visibility === "PUBLIC" ? "🙈 Nicht sichtbar machen" : "👁️ Sichtbar machen";

  return (
    <div className="ownerActions">
      <form action={setFlightVisibilityAction}>
        <input type="hidden" name="flightId" value={flightId} />
        <input type="hidden" name="visibility" value={nextVisibility} />
        <input type="hidden" name="returnTo" value={currentPath} />
        <button className="btn btnSecondary" type="submit">
          {visibilityLabel}
        </button>
      </form>

      <form
        action={deleteFlightAction}
        onSubmit={(event) => {
          const ok = window.confirm(
            "Diesen Flug wirklich löschen? Die Aktion kann nicht rückgängig gemacht werden."
          );

          if (!ok) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="flightId" value={flightId} />
        <input type="hidden" name="returnTo" value={`/${locale}/profile`} />
        <button className="btn btnDanger" type="submit">
          🗑️ Löschen
        </button>
      </form>
    </div>
  );
}