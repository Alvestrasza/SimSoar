"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {canCompareFlights} from "@/lib/flight-comparison";

type FlightOption = {id: string; title: string; pilotCallsign: string; simulator: string; glider?: string | null; createdAt: string};

export default function FlightCompareSelector({flights, initialIds}: {flights: FlightOption[]; initialIds: string[]}) {
  const t = useTranslations("FlightComparison");
  const router = useRouter();
  const [selected, setSelected] = useState(initialIds);
  const full = selected.length >= 5;

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : current.length < 5 ? [...current, id] : current);
  }

  function compare() {
    if (!canCompareFlights(selected)) return;
    const query = new URLSearchParams();
    selected.forEach((id) => query.append("id", id));
    router.push(`/flights/compare?${query.toString()}`);
  }

  return <section className="card comparisonSelector">
    <div className="cardHead"><div><span className="cardTitle">{t("chooseTitle")}</span><p className="muted">{t("chooseHint")}</p></div><strong>{t("selected", {count: selected.length})}</strong></div>
    <div className="comparisonChoices">{flights.length === 0 ? <p className="muted">{t("empty")}</p> : flights.map((flight) => {
      const checked = selected.includes(flight.id);
      return <label className={`comparisonChoice ${checked ? "selected" : ""}`} key={flight.id}>
        <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggle(flight.id)} />
        <span><strong>{flight.pilotCallsign}</strong><small>{flight.title} · {flight.glider || flight.simulator}</small></span>
      </label>;
    })}</div>
    <button className="btn btnPrimary" type="button" disabled={!canCompareFlights(selected)} onClick={compare}>{t("compare")}</button>
  </section>;
}
