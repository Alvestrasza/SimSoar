"use client";

import {useTranslations} from "next-intl";
import {restoreFlightAction} from "@/app/[locale]/admin/flights/actions";

type AdminFlightRestoreButtonProps = {
  flightId: string;
  flightTitle: string;
  returnTo: string;
};

export default function AdminFlightRestoreButton({
  flightId,
  flightTitle,
  returnTo
}: AdminFlightRestoreButtonProps) {
  const t = useTranslations("AdminFlights");

  return (
    <form
      action={restoreFlightAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          t("restoreConfirm", {
            title: flightTitle
          })
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="flightId" value={flightId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <button className="btn btnSecondary btnSmall" type="submit">
        {t("restore")}
      </button>
    </form>
  );
}
