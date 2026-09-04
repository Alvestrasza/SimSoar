"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {taskDistanceKm, type TaskPoint} from "@/lib/task-planner";

type PlannerPoint = TaskPoint & {clientId: string};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  taskId?: string;
  initialName?: string;
  initialDescription?: string;
  initialVisibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  initialPoints?: TaskPoint[];
  libraryPoints?: Array<TaskPoint & {id: string}>;
};

function markerIcon(L: typeof import("leaflet"), number: number) {
  return L.divIcon({
    html: `<span>${number}</span>`,
    className: "taskWaypointMarker",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

export default function TaskPlanner({action, locale, taskId, initialName = "", initialDescription = "", initialVisibility = "PRIVATE", initialPoints = [], libraryPoints = []}: Props) {
  const t = useTranslations("Tasks");
  const mapEl = useRef<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<PlannerPoint[]>(() => initialPoints.map((point, index) => ({...point, clientId: `initial-${index}`})));
  const [libraryPointId, setLibraryPointId] = useState("");
  const distanceKm = useMemo(() => taskDistanceKm(points), [points]);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    void import("leaflet").then((L) => {
      if (disposed || !mapEl.current) return;
      map = L.map(mapEl.current).setView([51, 10], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap"}).addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        setPoints((current) => [...current, {clientId: crypto.randomUUID(), lat: event.latlng.lat, lon: event.latlng.lng, radiusM: 500}]);
      });
      if (points.length > 0) map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lon])), {padding: [30, 30]});
      points.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lon], {draggable: true, icon: markerIcon(L, index + 1)}).addTo(map!);
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          setPoints((current) => current.map((entry) => entry.clientId === point.clientId ? {...entry, lat: position.lat, lon: position.lng} : entry));
        });
      });
      if (points.length > 1) L.polyline(points.map((point) => [point.lat, point.lon]), {color: "#1f6feb", weight: 4}).addTo(map);
      setTimeout(() => map?.invalidateSize(), 50);
    });
    return () => { disposed = true; map?.remove(); };
  }, [points]);

  function updatePoint(clientId: string, changes: Partial<PlannerPoint>) {
    setPoints((current) => current.map((point) => point.clientId === clientId ? {...point, ...changes} : point));
  }

  function movePoint(index: number, direction: -1 | 1) {
    setPoints((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return <form action={action} className="taskPlannerForm">
    <input type="hidden" name="locale" value={locale} />
    {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
    <input type="hidden" name="waypoints" value={JSON.stringify(points.map(({clientId: _clientId, ...point}) => point))} />
    <section className="card">
      <div className="cardHead"><div><span className="cardTitle">{taskId ? t("editTitle") : t("createTitle")}</span><p className="muted">{t("plannerHint")}</p></div><strong>{distanceKm.toFixed(1)} km</strong></div>
      <div className="taskPlannerLayout">
        <div ref={mapEl} className="taskPlannerMap" aria-label={t("mapLabel")} />
        <div className="taskWaypointPanel">
          <div className="formGrid taskMetadataGrid">
            <label><span>{t("name")}</span><input name="name" required minLength={2} maxLength={120} defaultValue={initialName} /></label>
            <label><span>{t("visibility")}</span><select name="visibility" defaultValue={initialVisibility}><option value="PUBLIC">{t("visibility_PUBLIC")}</option><option value="UNLISTED">{t("visibility_UNLISTED")}</option><option value="PRIVATE">{t("visibility_PRIVATE")}</option></select></label>
          </div>
          <label><span>{t("description")}</span><textarea name="description" maxLength={2000} defaultValue={initialDescription} /></label>
          {libraryPoints.length > 0 ? <div className="taskLibraryPicker"><select aria-label={t("library")} value={libraryPointId} onChange={(event) => setLibraryPointId(event.target.value)}><option value="">{t("chooseLibraryWaypoint")}</option>{libraryPoints.map((point) => <option key={point.id} value={point.id}>{point.code ? `${point.code} · ` : ""}{point.name}</option>)}</select><button className="btn btnSecondary" type="button" disabled={!libraryPointId} onClick={() => { const selected = libraryPoints.find((point) => point.id === libraryPointId); if (selected) setPoints((current) => [...current, {...selected, clientId: crypto.randomUUID()}]); }}>{t("addLibraryWaypoint")}</button></div> : null}
          <div className="taskWaypointList">
            {points.length === 0 ? <p className="muted">{t("emptyPlanner")}</p> : points.map((point, index) => <fieldset className="taskWaypointRow" key={point.clientId}>
              <legend>{t("waypoint", {number: index + 1})}</legend>
              <input aria-label={t("waypointName")} placeholder={t("waypointName")} value={point.name ?? ""} onChange={(event) => updatePoint(point.clientId, {name: event.target.value})} />
              <input aria-label={t("waypointCode")} placeholder={t("waypointCode")} value={point.code ?? ""} onChange={(event) => updatePoint(point.clientId, {code: event.target.value.toUpperCase()})} />
              <input aria-label={t("radius")} title={t("radius")} type="number" min={50} max={20000} step={50} value={point.radiusM ?? 500} onChange={(event) => updatePoint(point.clientId, {radiusM: Number(event.target.value)})} />
              <div className="taskWaypointCoordinates">{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</div>
              <div className="taskWaypointActions"><button type="button" className="btn btnSecondary" disabled={index === 0} onClick={() => movePoint(index, -1)}>↑</button><button type="button" className="btn btnSecondary" disabled={index === points.length - 1} onClick={() => movePoint(index, 1)}>↓</button><button type="button" className="btn btnDanger" onClick={() => setPoints((current) => current.filter((entry) => entry.clientId !== point.clientId))}>{t("remove")}</button></div>
            </fieldset>)}
          </div>
          <button className="btn btnPrimary" type="submit" disabled={points.length < 2}>{t("save")}</button>
        </div>
      </div>
    </section>
  </form>;
}
