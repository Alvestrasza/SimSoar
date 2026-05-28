"use client";

import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";

type ProfileNoticeStatus = "saved" | "flightUpdated" | "flightDeleted";

type ProfileSaveNoticeProps = {
  status: ProfileNoticeStatus;
};

export function ProfileSaveNotice({status}: ProfileSaveNoticeProps) {
  const t = useTranslations("Profile");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);

      const url = new URL(window.location.href);
      url.searchParams.delete("saved");
      url.searchParams.delete("flightUpdated");
      url.searchParams.delete("flightDeleted");
      window.history.replaceState({}, "", url.toString());
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <p
      className="muted"
      style={{
        marginTop: 10,
        color: "var(--green)",
        fontWeight: 600
      }}
    >
      {t(status)}
    </p>
  );
}