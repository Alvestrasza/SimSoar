import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flight = await prisma.flight.findUnique({
    where: { id },
    include: { track: { orderBy: { seq: "asc" }, take: 800 }, thermals: { orderBy: { seq: "asc" } } }
  });
  if (!flight || flight.visibility !== "PUBLIC") notFound();

  return (
    <main className="wrap">
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="cardHead">
          <div>
            <div className="cardTitle">{flight.title}</div>
            <div className="muted">{flight.pilotCallsign} · {flight.simulator} · {flight.glider ?? "Unbekanntes Muster"}</div>
          </div>
        </div>
        <div className="cardBody grid grid3">
          <div><span className="statValue">{Math.round(flight.distanceKm)} km</span><br /><span className="statLabel">Strecke</span></div>
          <div><span className="statValue">{Math.round(flight.olcPoints)}</span><br /><span className="statLabel">OLC</span></div>
          <div><span className="statValue">{flight.maxVarioMs.toFixed(1)} m/s</span><br /><span className="statLabel">Max Steigen</span></div>
        </div>
      </div>

      <div className="twoCol">
        <section className="card">
          <div className="cardHead"><span className="cardTitle">🗺️ Trackdaten</span></div>
          <div className="cardBody">
            <div className="mapPlaceholder">Leaflet-Komponente kann hier clientseitig ergänzt werden. {flight.track.length} Punkte geladen.</div>
          </div>
        </section>
        <aside className="grid">
          <div className="card">
            <div className="cardHead"><span className="cardTitle">🌡️ Thermiken</span></div>
            <div className="cardBody">
              {flight.thermals.length === 0 ? <p className="muted">Keine Thermiken erkannt.</p> : flight.thermals.map((t) => (
                <p key={t.id}><strong>#{t.seq}</strong> · Ø {t.avgClimbMs.toFixed(1)} m/s · +{t.gainM} m</p>
              ))}
            </div>
          </div>
          {flight.comment && <div className="card"><div className="cardHead"><span className="cardTitle">💬 Kommentar</span></div><div className="cardBody muted">{flight.comment}</div></div>}
        </aside>
      </div>
    </main>
  );
}
