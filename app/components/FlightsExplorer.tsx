"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import FlightsOverviewMap from "@/app/components/FlightsOverviewMap";

type TrackPoint = {
  lat: number;
  lon: number;
  altM: number;
};

type FlightListItem = {
  id: string;
  title: string;
  pilotCallsign: string;
  simulator: string;
  glider?: string | null;
  registration?: string | null;
  distanceKm: number;
  olcPoints: number;
  avgSpeedKmh: number;
  maxVarioMs: number;
  durationSeconds: number;
  createdAt: string;
  track: TrackPoint[];
};

type Props = {
  flights: FlightListItem[];
  activeFilter: FilterKey;
  filterLinks: Record<FilterKey, string>;
};

type SortKey = "olcPoints" | "distanceKm" | "maxVarioMs";
type FilterKey = "all" | "msfs" | "condor" | "xplane";

function simClass(sim: string) {
  if (sim.includes("MSFS")) return "simBadge msfs";
  if (sim.includes("Condor")) return "simBadge condor";
  if (sim.includes("X-Plane")) return "simBadge xplane";
  return "simBadge other";
}

function buildSvgPath(points: TrackPoint[], width = 280, height = 140) {
  if (points.length < 2) return "";

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const pad = 16;
  const step = Math.max(1, Math.floor(points.length / 120));
  const commands: string[] = [];

  for (let i = 0; i < points.length; i += step) {
    const p = points[i];

    const x =
      pad + ((p.lon - minLon) / (maxLon - minLon || 1)) * (width - pad * 2);

    const y =
      height -
      pad -
      ((p.lat - minLat) / (maxLat - minLat || 1)) * (height - pad * 2);

    commands.push(
      `${commands.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    );
  }

  return commands.join(" ");
}

function FlightCard({
  flight,
  unknownGlider,
  noTrackData
}: {
  flight: FlightListItem;
  unknownGlider: string;
  noTrackData: string;
}) {
  const path = buildSvgPath(flight.track);

  return (
    <Link className="flightCard" href={`/flights/${flight.id}`}>
      <div className="flightCardMap">
        <div className="mapDots" />

        <svg viewBox="0 0 280 140" aria-hidden="true">
          {path ? (
            <path d={path} className="flightPath" />
          ) : (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              fill="rgba(31,111,235,.35)"
              fontSize="12"
            >
              {noTrackData}
            </text>
          )}
        </svg>

        <span className={simClass(flight.simulator)}>
          {flight.simulator}
        </span>
      </div>

      <div className="flightCardBody">
        <strong>{flight.pilotCallsign}</strong>

        <p className="muted">
          {flight.glider ?? unknownGlider}
          {flight.registration ? ` · ${flight.registration}` : ""}
        </p>

        <div className="flightCardStats">
          <span>{Math.round(flight.distanceKm)} km</span>
          <span>{Math.round(flight.olcPoints)} OLC</span>
          <span>▲ {flight.maxVarioMs.toFixed(1)}</span>
        </div>
      </div>
    </Link>
  );
}

function SimDistributionChart({
  flights,
  flightsLabel,
  noData
}: {
  flights: FlightListItem[];
  flightsLabel: string;
  noData: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const counts = useMemo(() => {
    const result = new Map<string, number>();

    flights.forEach((f) => {
      result.set(f.simulator, (result.get(f.simulator) ?? 0) + 1);
    });

    return [...result.entries()];
  }, [flights]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = Math.max(
      220,
      Math.floor(canvas.getBoundingClientRect().width || 280)
    );

    const height = 130;
    const scale = window.devicePixelRatio || 1;

    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, width, height);

    const total = counts.reduce((sum, [, value]) => sum + value, 0);
    const colors = ["#1f6feb", "#ea580c", "#7c3aed", "#475569", "#16a34a"];

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 10;

    if (total === 0) {
      ctx.fillStyle = "#7d8797";
      ctx.font = "13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(noData, cx, cy);
      return;
    }

    let angle = -Math.PI / 2;

    counts.forEach(([, value], index) => {
      const slice = (value / total) * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();

      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      angle += slice;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);

    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.fillStyle = "#1d2433";
    ctx.font = "bold 15px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 6);

    ctx.fillStyle = "#7d8797";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText(flightsLabel, cx, cy + 10);
  }, [counts, flightsLabel, noData]);

  return (
    <>
      <canvas ref={canvasRef} className="simChart" />

      <div className="chartLegend">
        {counts.length === 0 ? (
          <span className="muted">{noData}</span>
        ) : (
          counts.map(([sim, value]) => (
            <div key={sim}>
              <span>{sim}</span>
              <strong>{value}</strong>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function FlightsExplorer({
  flights,
  activeFilter,
  filterLinks
}: Props) {
  const t = useTranslations("Flights");

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [highlightedFlightId, setHighlightedFlightId] = useState<string | null>(null);

  const [sort, setSort] = useState<{key: SortKey; dir: 1 | -1}>({
    key: "olcPoints",
    dir: -1
  });

  const filteredFlights = useMemo(() => {
    return [...flights]
      .sort(
        (a, b) =>
          sort.dir * ((a[sort.key] as number) - (b[sort.key] as number))
      );
  }, [flights, sort]);

  function setSortKey(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? {key, dir: prev.dir === 1 ? -1 : 1}
        : {key, dir: -1}
    );
  }

  return (
    <div className="twoCol">
      <section>
        <div className="card" style={{marginBottom: 22}}>
          <div
            className="cardHead"
            style={{paddingBottom: 0, borderBottom: "none"}}
          >
            <div className="tabs" style={{marginBottom: 0}}>
              <Link
                className={`tab ${activeFilter === "all" ? "active" : ""}`}
                href={filterLinks.all}
              >
                {t("tabAll")}
              </Link>

              <Link
                className={`tab ${activeFilter === "msfs" ? "active" : ""}`}
                href={filterLinks.msfs}
              >
                {t("tabMsfs")}
              </Link>

              <Link
                className={`tab ${activeFilter === "condor" ? "active" : ""}`}
                href={filterLinks.condor}
              >
                {t("tabCondor")}
              </Link>

              <Link
                className={`tab ${activeFilter === "xplane" ? "active" : ""}`}
                href={filterLinks.xplane}
              >
                {t("tabXplane")}
              </Link>
            </div>

            <div className="tabs" style={{marginBottom: 0}}>
              <button
                type="button"
                className={`tab ${viewMode === "list" ? "active" : ""}`}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                {t("viewList")}
              </button>
              <button
                type="button"
                className={`tab ${viewMode === "map" ? "active" : ""}`}
                aria-pressed={viewMode === "map"}
                onClick={() => setViewMode("map")}
              >
                {t("viewMap")}
              </button>
            </div>
          </div>

          {viewMode === "list" ? (
            <>
          <div className="tableWrap desktopTableOnly">
            <table>
              <thead>
                <tr>
                  <th>{t("rank")}</th>
                  <th>{t("pilot")}</th>

                  <th>
                    <button
                      className="sortButton"
                      onClick={() => setSortKey("distanceKm")}
                    >
                      {t("distance")}
                    </button>
                  </th>

                  <th>
                    <button
                      className="sortButton"
                      onClick={() => setSortKey("olcPoints")}
                    >
                      {t("olc")}
                    </button>
                  </th>

                  <th>{t("avgSpeed")}</th>

                  <th>
                    <button
                      className="sortButton"
                      onClick={() => setSortKey("maxVarioMs")}
                    >
                      {t("maxVario")}
                    </button>
                  </th>

                  <th>{t("simulator")}</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredFlights.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="emptyTable">
                      {t("noFlights")}
                    </td>
                  </tr>
                ) : (
                  filteredFlights.map((f, index) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{index + 1}</strong>
                      </td>

                      <td>
                        <strong>{f.pilotCallsign}</strong>
                        <br />
                        <span className="muted">
                          {f.glider ?? "–"}
                        </span>
                      </td>

                      <td>{Math.round(f.distanceKm)} km</td>

                      <td>
                        <strong>{Math.round(f.olcPoints)}</strong>
                      </td>

                      <td>{Math.round(f.avgSpeedKmh)} km/h</td>

                      <td className="textGreen">
                        ▲ {f.maxVarioMs.toFixed(1)} m/s
                      </td>

                      <td>
                        <span className={simClass(f.simulator)}>
                          {f.simulator}
                        </span>
                      </td>

                      <td>
                        <Link
                          className="btn btnSecondary"
                          href={`/flights/${f.id}`}
                        >
                          {t("details")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mobileFlightCards">
            {filteredFlights.length === 0 ? (
              <p className="muted emptyInline">{t("noFlights")}</p>
            ) : (
              filteredFlights.map((f, index) => (
                <Link className="mobileLeaderboardCard" href={`/flights/${f.id}`} key={f.id}>
                  <div className="mobileLeaderboardTop">
                    <div>
                      <strong>{f.pilotCallsign}</strong>
                      <p className="muted" style={{margin: "4px 0 0"}}>
                        {f.glider ?? "–"}
                      </p>
                    </div>

                    <span className="mobileLeaderboardRank">#{index + 1}</span>
                  </div>

                  <span className={simClass(f.simulator)}>
                    {f.simulator}
                  </span>

                  <div className="mobileLeaderboardStats">
                    <div>
                      <span>{t("distance")}</span>
                      <strong>{Math.round(f.distanceKm)} km</strong>
                    </div>

                    <div>
                      <span>{t("olc")}</span>
                      <strong>{Math.round(f.olcPoints)}</strong>
                    </div>

                    <div>
                      <span>{t("avgSpeed")}</span>
                      <strong>{Math.round(f.avgSpeedKmh)} km/h</strong>
                    </div>

                    <div>
                      <span>{t("maxVario")}</span>
                      <strong>▲ {f.maxVarioMs.toFixed(1)} m/s</strong>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
            </>
          ) : (
            <div className="flightsMapLayout">
              <FlightsOverviewMap
                flights={filteredFlights}
                highlightedFlightId={highlightedFlightId}
                startLabel={t("mapStart")}
                finishLabel={t("mapFinish")}
              />

              <div className="flightsMapSelector" aria-label={t("mapFlights")}>
                {filteredFlights.length === 0 ? (
                  <p className="muted emptyInline">{t("noFlights")}</p>
                ) : (
                  filteredFlights.map((flight) => (
                    <Link
                      key={flight.id}
                      href={`/flights/${flight.id}`}
                      className={`flightsMapSelectorItem ${
                        highlightedFlightId === flight.id ? "active" : ""
                      }`}
                      onMouseEnter={() => setHighlightedFlightId(flight.id)}
                      onMouseLeave={() => setHighlightedFlightId(null)}
                      onFocus={() => setHighlightedFlightId(flight.id)}
                      onBlur={() => setHighlightedFlightId(null)}
                    >
                      <strong>{flight.pilotCallsign}</strong>
                      <span>{flight.glider ?? t("unknownGlider")}</span>
                      <small>{Math.round(flight.distanceKm)} km · {Math.round(flight.olcPoints)} OLC</small>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sectionHead">
          <span className="cardTitle">{t("recentFlights")}</span>
        </div>

        <div className="flightGrid">
          {filteredFlights.slice(0, 6).map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              unknownGlider={t("unknownGlider")}
              noTrackData={t("noTrackData")}
            />
          ))}
        </div>
      </section>

      <aside className="grid">
        <div className="card">
          <div className="cardHead">
            <span className="cardTitle">{t("simDistribution")}</span>
          </div>

          <div className="cardBody">
            <SimDistributionChart
              flights={flights}
              flightsLabel={t("flightsLabel")}
              noData={t("noData")}
            />
          </div>
        </div>

        <div className="card">
          <div className="cardHead">
            <span className="cardTitle">{t("infoTitle")}</span>
          </div>

          <div className="cardBody muted lineHeight">
            <p>
              <strong>{t("infoMsfs")}</strong> {t("infoMsfsText")}
            </p>

            <p>
              <strong>{t("infoCondor")}</strong> {t("infoCondorText")}
            </p>

            <p>
              <strong>{t("infoXplane")}</strong> {t("infoXplaneText")}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
