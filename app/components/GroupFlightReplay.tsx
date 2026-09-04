"use client";

import {useEffect, useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {FLIGHT_COMPARISON_COLORS} from "@/lib/flight-comparison";
import {buildGroupReplayTimeline, groupReplayIndexAtElapsed} from "@/lib/group-replay";
import GroupReplayMap, {type GroupReplayFlight} from "@/app/components/GroupReplayMap";

type Flight = GroupReplayFlight & {track: Array<GroupReplayFlight["track"][number] & {time?: string | null}>};

function timeLabel(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function GroupFlightReplay({flights}: {flights: Flight[]}) {
  const t = useTranslations("FlightComparison");
  const timeline = useMemo(() => buildGroupReplayTimeline(flights), [flights]);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [visibleIds, setVisibleIds] = useState(() => flights.map((flight) => flight.id));
  const available = timeline.durationSeconds > 0;
  const activeIndexes = useMemo(() => Object.fromEntries(flights.map((flight) => [
    flight.id,
    groupReplayIndexAtElapsed(timeline.offsetsByFlightId[flight.id] ?? [], elapsed)
  ])), [elapsed, flights, timeline.offsetsByFlightId]);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - previous) / 1000;
      previous = now;
      setElapsed((current) => Math.min(timeline.durationSeconds, current + delta * speed));
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, speed, timeline.durationSeconds]);

  useEffect(() => {
    if (playing && elapsed >= timeline.durationSeconds) setPlaying(false);
  }, [elapsed, playing, timeline.durationSeconds]);

  function toggleFlight(id: string) {
    setVisibleIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <section className="card comparisonSection groupReplay" aria-label={t("groupReplayTitle")}>
    <div className="cardHead"><div><span className="cardTitle">{t("groupReplayTitle")}</span><p className="muted">{t("groupReplayDescription")}</p></div></div>
    <div className="groupReplayControls">
      <div className="replayControlRow">
        <div className="replayButtons">
          <button className="btn btnPrimary" type="button" disabled={!available || playing} onClick={() => setPlaying(true)}>{t("replayPlay")}</button>
          <button className="btn btnSecondary" type="button" disabled={!playing} onClick={() => setPlaying(false)}>{t("replayPause")}</button>
          <button className="btn btnSecondary" type="button" disabled={!available} onClick={() => {setPlaying(false); setElapsed(0);}}>{t("replayReset")}</button>
        </div>
        <label className="replaySpeed">{t("replaySpeed")}<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[0.5, 1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
      </div>
      <input className="replaySlider" type="range" min={0} max={timeline.durationSeconds} step={0.1} value={elapsed} disabled={!available} aria-label={t("groupReplayTimeline")} onChange={(event) => {setPlaying(false); setElapsed(Number(event.target.value));}} />
      <div className="replayStatus"><span>{timeLabel(elapsed)} / {timeLabel(timeline.durationSeconds)}</span><span>{timeline.usesRecordedTime ? t("groupReplayRecordedTime") : t("groupReplayRelativeTime")}</span></div>
      <div className="groupReplayPilots" aria-label={t("groupReplayPilots")}>
        {flights.map((flight, index) => <label key={flight.id} className={visibleIds.includes(flight.id) ? "selected" : ""}>
          <input type="checkbox" checked={visibleIds.includes(flight.id)} onChange={() => toggleFlight(flight.id)} />
          <i style={{background: FLIGHT_COMPARISON_COLORS[index]}} />
          <span><strong>{flight.pilotCallsign}</strong><small>{flight.title}</small></span>
        </label>)}
      </div>
    </div>
    <GroupReplayMap flights={flights} activeIndexes={activeIndexes} visibleIds={visibleIds} />
  </section>;
}
