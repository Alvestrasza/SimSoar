"use client";

import {
  deleteFlightAction,
  setFlightVisibilityAction
} from "@/app/profile/flight-actions";

type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

type Props = {
  flightId: string;
  visibility: Visibility;
  returnTo?: string;
};

export default function FlightOwnerActions({
  flightId,
  visibility,
  returnTo = "/profile"
}: Props) {
  const nextVisibility = visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
  const visibilityLabel =
    visibility === "PUBLIC" ? "🙈 Nicht sichtbar machen" : "👁️ Sichtbar machen";

  return (
    <div className="ownerActions">
      <form action={setFlightVisibilityAction}>
        <input type="hidden" name="flightId" value={flightId} />
        <input type="hidden" name="visibility" value={nextVisibility} />
        <input type="hidden" name="returnTo" value={returnTo} />
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
        <button className="btn btnDanger" type="submit">
          🗑️ Löschen
        </button>
      </form>
    </div>
  );
}