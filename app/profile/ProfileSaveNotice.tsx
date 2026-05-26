"use client";

import { useEffect, useState } from "react";

export function ProfileSaveNotice() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);

      const url = new URL(window.location.href);
      url.searchParams.delete("saved");
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
      ✓ Profil wurde erfolgreich gespeichert.
    </p>
  );
}