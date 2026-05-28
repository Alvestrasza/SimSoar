"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {Link} from "@/i18n/navigation";

type TrackPoint = { lat: number; lon: number; altM: number };
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

type Props = { flights: FlightListItem[] };
type SortKey = "olcPoints" | "distanceKm" | "maxVarioMs";
type FilterKey = "all" | "msfs" | "condor" | "xplane";

function simClass(sim: string) {
  if (sim.includes("MSFS")) return "simBadge msfs";
  if (sim.includes("Condor")) return "simBadge condor";
  if (sim.includes("X-Plane")) return "simBadge xplane";
  return "simBadge other";
}

function durationLabel(seconds: number) {
  const h = Math.floor(Math.max(0, seconds || 0) / 3600);
  const m = Math.floor((Math.max(0, seconds || 0) % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
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
    const x = pad + ((p.lon - minLon) / (maxLon - minLon || 1)) * (width - pad * 2);
    const y = height - pad - ((p.lat - minLat) / (maxLat - minLat || 1)) * (height - pad * 2);
    commands.push(`${commands.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return commands.join(" ");
}

function FlightCard({ flight }: { flight: FlightListItem }) {
  const path = buildSvgPath(flight.track);
  return (
    <Link className="flightCard" href={`/flights/${flight.id}`}>
      <div className="flightCardMap">
        <div className="mapDots" />
        <svg viewBox="0 0 280 140" aria-hidden="true">
          {path ? <path d={path} className="flightPath" /> : <text x="50%" y="50%" textAnchor="middle" fill="rgba(31,111,235,.35)" fontSize="12">Keine Trackdaten</text>}
        </svg>
        <span className={simClass(flight.simulator)}>{flight.simulator}</span>
      </div>
      <div className="flightCardBody">
        <strong>{flight.pilotCallsign}</strong>
        <p className="muted">{flight.glider ?? "Unbekanntes Muster"}{flight.registration ? ` · ${flight.registration}` : ""}</p>
        <div className="flightCardStats">
          <span>{Math.round(flight.distanceKm)} km</span>
          <span>{Math.round(flight.olcPoints)} OLC</span>
          <span>▲ {flight.maxVarioMs.toFixed(1)}</span>
        </div>
      </div>
    </Link>
  );
}

function SimDistributionChart({ flights }: { flights: FlightListItem[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    flights.forEach((f) => result.set(f.simulator, (result.get(f.simulator) ?? 0) + 1));
    return [...result.entries()];
  }, [flights]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(220, Math.floor(canvas.getBoundingClientRect().width || 280));
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
      ctx.fillText("Keine Flüge", cx, cy);
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
    ctx.fillText("Flüge", cx, cy + 10);
  }, [counts]);

  return (
    <>
      <canvas ref={canvasRef} className="simChart" />
      <div className="chartLegend">
        {counts.length === 0 ? <span className="muted">Noch keine Daten.</span> : counts.map(([sim, value]) => (
          <div key={sim}><span>{sim}</span><strong>{value}</strong></div>
        ))}
      </div>
    </>
  );
}

export default function FlightsExplorer({ flights }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "olcPoints", dir: -1 });

  const filteredFlights = useMemo(() => {
    return [...flights]
      .filter((f) => {
        if (filter === "all") return true;
        if (filter === "msfs") return f.simulator.includes("MSFS");
        if (filter === "condor") return f.simulator.includes("Condor");
        return f.simulator.includes("X-Plane");
      })
      .sort((a, b) => sort.dir * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [flights, filter, sort]);

  function setSortKey(key: SortKey) {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: -1 });
  }

  return (
    <div className="twoCol">
      <section>
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="cardHead" style={{ paddingBottom: 0, borderBottom: "none" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Gesamt</button>
              <button className={`tab ${filter === "msfs" ? "active" : ""}`} onClick={() => setFilter("msfs")}>MSFS</button>
              <button className={`tab ${filter === "condor" ? "active" : ""}`} onClick={() => setFilter("condor")}>Condor</button>
              <button className={`tab ${filter === "xplane" ? "active" : ""}`} onClick={() => setFilter("xplane")}>X-Plane</button>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Pilot</th>
                  <th><button className="sortButton" onClick={() => setSortKey("distanceKm")}>Strecke ↕</button></th>
                  <th><button className="sortButton" onClick={() => setSortKey("olcPoints")}>OLC ↕</button></th>
                  <th>Ø km/h</th>
                  <th><button className="sortButton" onClick={() => setSortKey("maxVarioMs")}>Max ▲ ↕</button></th>
                  <th>Simulator</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredFlights.length === 0 ? (
                  <tr><td colSpan={8} className="emptyTable">Noch keine Flüge vorhanden.</td></tr>
                ) : filteredFlights.map((f, index) => (
                  <tr key={f.id}>
                    <td><strong>{index + 1}</strong></td>
                    <td><strong>{f.pilotCallsign}</strong><br /><span className="muted">{f.glider ?? "–"}</span></td>
                    <td>{Math.round(f.distanceKm)} km</td>
                    <td><strong>{Math.round(f.olcPoints)}</strong></td>
                    <td>{Math.round(f.avgSpeedKmh)} km/h</td>
                    <td className="textGreen">▲ {f.maxVarioMs.toFixed(1)} m/s</td>
                    <td><span className={simClass(f.simulator)}>{f.simulator}</span></td>
                    <td><Link className="btn btnSecondary" href={`/flights/${f.id}`}>Details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sectionHead"><span className="cardTitle">🕐 Aktuelle Flüge</span></div>
        <div className="flightGrid">{filteredFlights.slice(0, 6).map((flight) => <FlightCard key={flight.id} flight={flight} />)}</div>
      </section>

      <aside className="grid">
        <div className="card">
          <div className="cardHead"><span className="cardTitle">📊 Simulator-Verteilung</span></div>
          <div className="cardBody"><SimDistributionChart flights={flights} /></div>
        </div>
        <div className="card">
          <div className="cardHead"><span className="cardTitle">ℹ️ IGC aus Simulatoren</span></div>
          <div className="cardBody muted lineHeight">
            <p><strong>MSFS 2024/2020:</strong> OLC Recorder Add-On oder Kinetic Assistant</p>
            <p><strong>Condor 2:</strong> Direkt nach dem Flug im Menü exportieren</p>
            <p><strong>X-Plane 12:</strong> X-IGC Plugin oder SoaringSimPlugin</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
