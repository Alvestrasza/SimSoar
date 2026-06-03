"use client";

import {useTranslations} from "next-intl";
import {softDeleteFlightAction} from "@/app/[locale]/admin/flights/actions";

type AdminFlightDeleteButtonProps = {
  flightId: string;
  flightTitle: string;
  returnTo: string;
  isSoftDeleted?: boolean;
};

export default function AdminFlightDeleteButton({
  flightId,
  flightTitle,
  returnTo,
  isSoftDeleted = false
}: AdminFlightDeleteButtonProps) {
  const t = useTranslations("AdminFlights");

  return (
    <form
      action={softDeleteFlightAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          t(isSoftDeleted ? "purgeConfirm" : "deleteConfirm", {
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

      <button className="btn btnDanger btnSmall" type="submit">
        {isSoftDeleted ? t("purge") : t("delete")}
      </button>
    </form>
  );
}
