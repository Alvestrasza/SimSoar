"use client";

import {useTranslations} from "next-intl";
import {unblockIgcUploadHashAction} from "@/app/[locale]/admin/igc-blocks/actions";

type UnblockIgcUploadButtonProps = {
  blockId: string;
  igcSha256: string;
  returnTo: string;
};

export default function UnblockIgcUploadButton({
  blockId,
  igcSha256,
  returnTo
}: UnblockIgcUploadButtonProps) {
  const t = useTranslations("AdminIgcBlocks");

  return (
    <form
      action={unblockIgcUploadHashAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          t("unblockConfirm", {
            hash: igcSha256.slice(0, 16)
          })
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <button className="btn btnDanger btnSmall" type="submit">
        {t("unblock")}
      </button>
    </form>
  );
}
