"use client";

import { useState } from "react";
import {Link} from "@/i18n/navigation";
import AltitudeChart from "./AltitudeChart";
import FlightTrackMap from "./FlightTrackMap";
import FlightOwnerActions from "./FlightOwnerActions";

type TrackPoint = {
  seq: number;
  lat: number;
  lon: number;
  altM: number;
  varioMs?: number | null;
};

type Thermal = {
  id: string;
  seq: number;
  centerLat?: number | null;
  centerLon?: number | null;
  avgClimbMs: number;
  maxClimbMs: number;
  gainM: number;
  durationSec: number;
};

type FlightDetail = {
  id: string;
  title: string;
  pilotCallsign: string;
  simulator: string;
  glider?: string | null;
  registration?: string | null;
  competitionClass?: string | null;
  comment?: string | null;
  startTime?: string | null;
  durationSeconds: number;
  distanceKm: number;
  olcPoints: number;
  avgSpeedKmh: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxVarioMs: number;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  canManage: boolean;
  track: TrackPoint[];
  thermals: Thermal[];
};

type Props = { flight: FlightDetail };

type Tab = "map" | "altitude" | "thermals" | "info";

function durationLabel(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
}

function isoDateLabel(value?: string | null) {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE");
}

function tabClass(tab: Tab, current: Tab) {
  return `tab ${tab === current ? "active" : ""}`;
}

export default function FlightDetailClient({ flight }: Props) {
  const [tab, setTab] = useState<Tab>("map");
  const altProfile = flight.track.map((p) => p.altM).filter((alt) => Number.isFinite(alt));

  return (
    <main className="wrap">
      <div className="flightDetailHeader card">
        <Link className="btn btnSecondary" href="/flights">← Zurück</Link>

        <div className="flightDetailTitleBlock">
          <div className="flightDetailTitle">{flight.title}</div>
          <div className="muted">
            {flight.pilotCallsign} · {flight.simulator} · {flight.glider ?? "Unbekanntes Muster"}
            {flight.registration ? ` · ${flight.registration}` : ""}
          </div>
        </div>

        {flight.canManage ? (
          <FlightOwnerActions
            flightId={flight.id}
            visibility={flight.visibility}
          />
        ) : null}
      </div>

      <div className="flightStatsBar card">
        <div><span className="statValue">{Math.round(flight.distanceKm)} km</span><br /><span className="statLabel">Strecke</span></div>
        <div><span className="statValue">{Math.round(flight.olcPoints)}</span><br /><span className="statLabel">OLC</span></div>
        <div><span className="statValue">{Math.round(flight.avgSpeedKmh)}</span><br /><span className="statLabel">Ø km/h</span></div>
        <div><span className="statValue">{durationLabel(flight.durationSeconds)}</span><br /><span className="statLabel">Dauer</span></div>
        <div><span className="statValue">+{flight.maxVarioMs.toFixed(1)}</span><br /><span className="statLabel">Max ▲ m/s</span></div>
        <div><span className="statValue">{flight.maxAltitudeM} m</span><br /><span className="statLabel">Max Höhe</span></div>
      </div>

      <div className="twoCol">
        <section className="card detailMainCard">
          <div className="tabs detailTabs">
            <button className={tabClass("map", tab)} onClick={() => setTab("map")}>🗺️ Karte</button>
            <button className={tabClass("altitude", tab)} onClick={() => setTab("altitude")}>📈 Höhenprofil</button>
            <button className={tabClass("thermals", tab)} onClick={() => setTab("thermals")}>🌡️ Thermiken</button>
            <button className={tabClass("info", tab)} onClick={() => setTab("info")}>ℹ️ Fluginfo</button>
          </div>

          <div className={tab === "map" ? "tabPane" : "tabPane hidden"}>
            <FlightTrackMap points={flight.track} thermals={flight.thermals} active={tab === "map"} />
          </div>

          <div className={tab === "altitude" ? "tabPane padded" : "tabPane padded hidden"}>
            <h3>Höhenprofil über Flugdauer</h3>
            {altProfile.length > 1 ? (
              <>
                <AltitudeChart profile={altProfile} minAlt={flight.minAltitudeM} maxAlt={flight.maxAltitudeM} />
                <div className="smallStats">
                  <span>⬆ Max: <strong>{flight.maxAltitudeM}</strong> m</span>
                  <span>⬇ Min: <strong>{flight.minAltitudeM}</strong> m</span>
                  <span>↕ Δ: <strong>{flight.maxAltitudeM - flight.minAltitudeM}</strong> m</span>
                </div>
              </>
            ) : <p className="muted">Keine ausreichenden Höhendaten vorhanden.</p>}
          </div>

          <div className={tab === "thermals" ? "tabPane padded" : "tabPane padded hidden"}>
            <h3>Erkannte Aufwinde</h3>
            <p className="muted">Automatische Erkennung von Steigphasen in der IGC-Datei.</p>
            {flight.thermals.length === 0 ? (
              <p className="muted emptyInline">Keine Thermiken erkannt.</p>
            ) : (
              <div className="thermalList">
                {flight.thermals.map((thermal) => (
                  <div className="thermalItem" key={thermal.id}>
                    <div className="thermalBubble">+{thermal.avgClimbMs.toFixed(1)}</div>
                    <div>
                      <strong>Thermik #{thermal.seq}</strong>
                      <div className="muted">+{thermal.gainM} m · {thermal.durationSec}s · max. {thermal.maxClimbMs.toFixed(1)} m/s</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={tab === "info" ? "tabPane padded" : "tabPane padded hidden"}>
            <div className="detailRows">
              <div><span>Pilot</span><strong>{flight.pilotCallsign}</strong></div>
              <div><span>Simulator</span><strong>{flight.simulator}</strong></div>
              <div><span>Flugzeug</span><strong>{flight.glider ?? "–"}</strong></div>
              <div><span>Kennzeichen</span><strong>{flight.registration ?? "–"}</strong></div>
              <div><span>Klasse</span><strong>{flight.competitionClass ?? "–"}</strong></div>
              <div><span>Datum</span><strong>{isoDateLabel(flight.startTime)}</strong></div>
              <div><span>GPS-Punkte</span><strong>{flight.track.length}</strong></div>
            </div>
          </div>
        </section>

        <aside className="grid">
          <div className="card">
            <div className="cardHead"><span className="cardTitle">📋 Flugdetails</span></div>
            <div className="cardBody detailRows compact">
              <div><span>Strecke</span><strong>{Math.round(flight.distanceKm)} km</strong></div>
              <div><span>OLC</span><strong>{Math.round(flight.olcPoints)}</strong></div>
              <div><span>Ø Geschwindigkeit</span><strong>{Math.round(flight.avgSpeedKmh)} km/h</strong></div>
              <div><span>Dauer</span><strong>{durationLabel(flight.durationSeconds)}</strong></div>
              <div><span>Max. Steigen</span><strong>+{flight.maxVarioMs.toFixed(1)} m/s</strong></div>
              <div><span>Max. Höhe</span><strong>{flight.maxAltitudeM} m</strong></div>
              <div><span>Thermiken</span><strong>{flight.thermals.length}</strong></div>
            </div>
          </div>
          {flight.comment ? (
            <div className="card">
              <div className="cardHead"><span className="cardTitle">💬 Kommentar</span></div>
              <div className="cardBody muted commentBox">{flight.comment}</div>
            </div>
          ) : null}
          <div className="card">
            <div className="cardHead"><span className="cardTitle">🌤️ Wetterbedingungen</span></div>
            <div className="cardBody wxGrid">
              <div><strong>22°C</strong><span>Temperatur</span></div>
              <div><strong>NW 12</strong><span>Wind</span></div>
              <div><strong>1013 hPa</strong><span>Luftdruck</span></div>
              <div><strong>FI 2800m</strong><span>Wolkenbasis</span></div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
