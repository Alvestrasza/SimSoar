"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
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

type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
type MapModePreference = "STANDARD" | "SATELLITE" | "TERRAIN";

type FlightDetail = {
  id: string;
  title: string;
  pilotCallsign: string;
  simulator: string;
  glider?: string | null;
  registration?: string | null;
  competitionClass?: string | null;
  weatherMode?: string | null;
  comment?: string | null;
  startTime?: string | null;
  durationSeconds: number;
  distanceKm: number;
  olcPoints: number;
  avgSpeedKmh: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  maxVarioMs: number;
  visibility: Visibility;
  publicIgcDownloadEnabled: boolean;
  canDownloadIgc: boolean;
  canManage: boolean;
  track: TrackPoint[];
  thermals: Thermal[];
};

type Props = {
  flight: FlightDetail;
  preferredMapMode?: MapModePreference;
};

type Tab = "map" | "altitude" | "thermals" | "info";

function durationLabel(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);

  return `${h}:${String(m).padStart(2, "0")} h`;
}

function isoDateLabel(value: string | null | undefined, locale: string) {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "–";
  }

  return date.toLocaleDateString(locale === "en" ? "en-US" : "de-DE");
}

function competitionClassLabel(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return "–";

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "club klasse" ||
    normalized === "club class"
  ) {
    return t("classClub");
  }

  if (
    normalized === "15 m klasse" ||
    normalized === "15 m class"
  ) {
    return t("class15m");
  }

  if (
    normalized === "18 m klasse" ||
    normalized === "18 m class"
  ) {
    return t("class18m");
  }

  if (
    normalized === "offene klasse" ||
    normalized === "open class"
  ) {
    return t("classOpen");
  }

  if (
    normalized === "doppelsitzer" ||
    normalized === "two-seater" ||
    normalized === "two seater"
  ) {
    return t("classTwoSeater");
  }

  return value;
}

function weatherModeLabel(
  value: string | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (value === "LIVE") return t("weatherModeLive");
  if (value === "PRESET") return t("weatherModePreset");
  if (value === "CUSTOM") return t("weatherModeCustom");
  return t("weatherModeUnknown");
}

function tabClass(tab: Tab, current: Tab) {
  return `tab ${tab === current ? "active" : ""}`;
}

export default function FlightDetailClient({
  flight,
  preferredMapMode = "STANDARD"
}: Props) {
  const t = useTranslations("FlightDetail");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("map");

  const altProfile = flight.track
    .map((p) => p.altM)
    .filter((alt) => Number.isFinite(alt));

  return (
    <main className="wrap">
      <div className="flightDetailHeader card">
        <Link className="btn btnSecondary" href="/flights">
          {t("back")}
        </Link>

        <div className="flightDetailTitleBlock">
          <div className="flightDetailTitle">{flight.title}</div>

          <div className="muted">
            {flight.pilotCallsign} · {flight.simulator} ·{" "}
            {flight.glider ?? t("unknownGlider")}
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
        <div>
          <span className="statValue">
            {Math.round(flight.distanceKm)} km
          </span>
          <br />
          <span className="statLabel">{t("distance")}</span>
        </div>

        <div>
          <span className="statValue">
            {Math.round(flight.olcPoints)}
          </span>
          <br />
          <span className="statLabel">{t("olc")}</span>
        </div>

        <div>
          <span className="statValue">
            {Math.round(flight.avgSpeedKmh)}
          </span>
          <br />
          <span className="statLabel">{t("avgSpeed")}</span>
        </div>

        <div>
          <span className="statValue">
            {durationLabel(flight.durationSeconds)}
          </span>
          <br />
          <span className="statLabel">{t("duration")}</span>
        </div>

        <div>
          <span className="statValue">
            +{flight.maxVarioMs.toFixed(1)}
          </span>
          <br />
          <span className="statLabel">{t("maxVario")}</span>
        </div>

        <div>
          <span className="statValue">
            {flight.maxAltitudeM} m
          </span>
          <br />
          <span className="statLabel">{t("maxAltitude")}</span>
        </div>
      </div>

      <div className="twoCol">
        <section className="card detailMainCard">
          <div className="tabs detailTabs">
            <button
              className={tabClass("map", tab)}
              onClick={() => setTab("map")}
            >
              {t("tabMap")}
            </button>

            <button
              className={tabClass("altitude", tab)}
              onClick={() => setTab("altitude")}
            >
              {t("tabAltitude")}
            </button>

            <button
              className={tabClass("thermals", tab)}
              onClick={() => setTab("thermals")}
            >
              {t("tabThermals")}
            </button>

            <button
              className={tabClass("info", tab)}
              onClick={() => setTab("info")}
            >
              {t("tabInfo")}
            </button>
          </div>

          <div className={tab === "map" ? "tabPane" : "tabPane hidden"}>
            <FlightTrackMap
              points={flight.track}
              thermals={flight.thermals}
              active={tab === "map"}
              mapMode={preferredMapMode}
            />
          </div>

          <div
            className={
              tab === "altitude"
                ? "tabPane padded"
                : "tabPane padded hidden"
            }
          >
            <h3>{t("altitudeTitle")}</h3>

            {altProfile.length > 1 ? (
              <>
                <AltitudeChart
                  profile={altProfile}
                  minAlt={flight.minAltitudeM}
                  maxAlt={flight.maxAltitudeM}
                />

                <div className="smallStats">
                  <span>
                    {t("altitudeMax")}:{" "}
                    <strong>{flight.maxAltitudeM}</strong> m
                  </span>

                  <span>
                    {t("altitudeMin")}:{" "}
                    <strong>{flight.minAltitudeM}</strong> m
                  </span>

                  <span>
                    {t("altitudeDelta")}:{" "}
                    <strong>
                      {flight.maxAltitudeM - flight.minAltitudeM}
                    </strong>{" "}
                    m
                  </span>
                </div>
              </>
            ) : (
              <p className="muted">{t("noAltitudeData")}</p>
            )}
          </div>

          <div
            className={
              tab === "thermals"
                ? "tabPane padded"
                : "tabPane padded hidden"
            }
          >
            <h3>{t("thermalsTitle")}</h3>

            <p className="muted">{t("thermalsDescription")}</p>

            {flight.thermals.length === 0 ? (
              <p className="muted emptyInline">{t("noThermals")}</p>
            ) : (
              <div className="thermalList">
                {flight.thermals.map((thermal) => (
                  <div className="thermalItem" key={thermal.id}>
                    <div className="thermalBubble">
                      +{thermal.avgClimbMs.toFixed(1)}
                    </div>

                    <div>
                      <strong>
                        {t("thermal")} #{thermal.seq}
                      </strong>

                      <div className="muted">
                        {t("thermalGain")}: +{thermal.gainM} m ·{" "}
                        {t("thermalDuration")}: {thermal.durationSec}s ·{" "}
                        {t("thermalMax")}{" "}
                        {thermal.maxClimbMs.toFixed(1)} m/s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className={
              tab === "info"
                ? "tabPane padded"
                : "tabPane padded hidden"
            }
          >
            <div className="detailRows">
              <div>
                <span>{t("pilot")}</span>
                <strong>{flight.pilotCallsign}</strong>
              </div>

              <div>
                <span>{t("simulator")}</span>
                <strong>{flight.simulator}</strong>
              </div>

              <div>
                <span>{t("aircraft")}</span>
                <strong>{flight.glider ?? "–"}</strong>
              </div>

              <div>
                <span>{t("registration")}</span>
                <strong>{flight.registration ?? "–"}</strong>
              </div>

              <div>
                <span>{t("class")}</span>
                <strong>{competitionClassLabel(flight.competitionClass, t)}</strong>
              </div>

              <div>
                <span>{t("weatherMode")}</span>
                <strong>{weatherModeLabel(flight.weatherMode, t)}</strong>
              </div>

              <div>
                <span>{t("date")}</span>
                <strong>{isoDateLabel(flight.startTime, locale)}</strong>
              </div>

              <div>
                <span>{t("gpsPoints")}</span>
                <strong>{flight.track.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid">
          <div className="card">
            <div className="cardHead">
              <span className="cardTitle">{t("detailsTitle")}</span>
            </div>

            <div className="cardBody detailRows compact">
              <div>
                <span>{t("distance")}</span>
                <strong>{Math.round(flight.distanceKm)} km</strong>
              </div>

              <div>
                <span>{t("olc")}</span>
                <strong>{Math.round(flight.olcPoints)}</strong>
              </div>

              <div>
                <span>{t("avgSpeedLong")}</span>
                <strong>{Math.round(flight.avgSpeedKmh)} km/h</strong>
              </div>

              <div>
                <span>{t("duration")}</span>
                <strong>{durationLabel(flight.durationSeconds)}</strong>
              </div>

              <div>
                <span>{t("maxClimb")}</span>
                <strong>+{flight.maxVarioMs.toFixed(1)} m/s</strong>
              </div>

              <div>
                <span>{t("maxAltitude")}</span>
                <strong>{flight.maxAltitudeM} m</strong>
              </div>

              <div>
                <span>{t("thermals")}</span>
                <strong>{flight.thermals.length}</strong>
              </div>
            </div>
          </div>

          {flight.canDownloadIgc ? (
            <div className="card">
              <div className="cardHead">
                <span className="cardTitle">{t("igcDownloadTitle")}</span>
              </div>

              <div className="cardBody">
                <p className="muted" style={{marginTop: 0}}>
                  {flight.publicIgcDownloadEnabled
                    ? t("igcDownloadPublicHint")
                    : t("igcDownloadPrivateHint")}
                </p>

                <a
                  className="btn btnPrimary"
                  href={`/${locale}/flights/${flight.id}/igc`}
                >
                  {t("downloadIgc")}
                </a>
              </div>
            </div>
          ) : null}

          {flight.comment ? (
            <div className="card">
              <div className="cardHead">
                <span className="cardTitle">{t("commentTitle")}</span>
              </div>

              <div className="cardBody muted commentBox">
                {flight.comment}
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="cardHead">
              <span className="cardTitle">{t("weatherTitle")}</span>
            </div>

            <div className="cardBody wxGrid">
              <div>
                <strong>22°C</strong>
                <span>{t("temperature")}</span>
              </div>

              <div>
                <strong>NW 12</strong>
                <span>{t("wind")}</span>
              </div>

              <div>
                <strong>1013 hPa</strong>
                <span>{t("pressure")}</span>
              </div>

              <div>
                <strong>FI 2800m</strong>
                <span>{t("cloudbase")}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
