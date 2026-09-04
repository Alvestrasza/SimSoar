"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";

export default function FlightSharePanel({title, shareUrl, embedUrl}: {title: string; shareUrl: string; embedUrl: string}) {
  const t = useTranslations("FlightShare");
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const safeTitle = title.replace(/[&<>"]/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[character]!);
  const embedCode = `<iframe src="${embedUrl}" title="${safeTitle}" width="100%" height="520" loading="lazy" sandbox="allow-popups allow-popups-to-escape-sandbox" style="border:0;border-radius:12px" allowfullscreen></iframe>`;

  async function copy(value: string, kind: "link" | "embed") {
    if (navigator.clipboard) await navigator.clipboard.writeText(value);
    else {
      const field = document.createElement("textarea");
      field.value = value; field.style.position = "fixed"; field.style.opacity = "0";
      document.body.append(field); field.select(); document.execCommand("copy"); field.remove();
    }
    setCopied(kind);
  }

  async function share() {
    if (!navigator.share) {
      await copy(shareUrl, "link");
      return;
    }
    try {
      await navigator.share({title, url: shareUrl});
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") throw error;
    }
  }

  return <section className="card flightSharePanel">
    <div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("description")}</p></div></div>
    <div className="cardBody flightShareGrid">
      <div><label htmlFor="flight-share-url">{t("shareLink")}</label><div className="flightShareRow"><input id="flight-share-url" readOnly value={shareUrl} /><button className="btn btnSecondary" type="button" onClick={() => copy(shareUrl, "link")}>{copied === "link" ? t("copied") : t("copy")}</button><button className="btn btnPrimary" type="button" onClick={share}>{t("share")}</button></div><span className="srOnly" aria-live="polite">{copied === "link" ? t("copiedStatus") : ""}</span></div>
      <div><label htmlFor="flight-embed-code">{t("embedCode")}</label><div className="flightShareRow"><textarea id="flight-embed-code" readOnly value={embedCode} /><button className="btn btnSecondary" type="button" onClick={() => copy(embedCode, "embed")}>{copied === "embed" ? t("copied") : t("copy")}</button></div><p className="muted">{t("embedHint")}</p><span className="srOnly" aria-live="polite">{copied === "embed" ? t("copiedStatus") : ""}</span></div>
      <iframe className="flightEmbedPreview" src={embedUrl} title={t("previewTitle")} loading="lazy" sandbox="allow-popups allow-popups-to-escape-sandbox" />
    </div>
  </section>;
}
