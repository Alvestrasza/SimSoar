import Link from "next/link";
import { prisma } from "@/lib/db";
import HomeMapPreview from "@/app/components/HomeMapPreview";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [totalFlights, totalPilots, best] = await Promise.all([
    prisma.flight.count({ where: { visibility: "PUBLIC" } }),
    prisma.pilotProfile.count(),
    prisma.flight.findFirst({ where: { visibility: "PUBLIC" }, orderBy: { distanceKm: "desc" } })
  ]);

  const recent = await prisma.flight.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, title: true, pilotCallsign: true, simulator: true, distanceKm: true, olcPoints: true, avgSpeedKmh: true, createdAt: true }
  });

  return (
    <>
      <section className="hero">
        <div className="heroInner">
          <div>
            <span className="kicker">🖥️ Simulator-Segelflug-Community</span>
            <h1>Virtuelle Flüge.<br /><span>Real analysiert.</span></h1>
            <p className="heroSub">
              Lade IGC-Dateien aus MSFS 2020/2024, Condor oder X-Plane hoch.
              Analysiere Strecke, Höhenprofil, Thermiken und OLC-Punkte in einer Multi-User-Plattform.
            </p>
            <p style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Link className="btn btnPrimary" href="/upload">↑ Flug hochladen</Link>
              <Link className="btn btnSecondary" href="/flights">Bestenliste ansehen</Link>
            </p>
            <div className="heroStats">
              <div><span className="statValue">{totalFlights}</span><br /><span className="statLabel">Virtuelle Flüge</span></div>
              <div><span className="statValue">{totalPilots}</span><br /><span className="statLabel">Sim-Piloten</span></div>
              <div><span className="statValue">{best ? `${Math.round(best.distanceKm)} km` : "–"}</span><br /><span className="statLabel">Längster Flug</span></div>
            </div>
          </div>
          <div className="card heroMapCard">
            <HomeMapPreview
              homeAirfield={null}
              preferHomeAirfield={false}
            />
          </div>
        </div>
      </section>

      <main className="wrap">
        <section className="grid grid3" style={{ marginBottom: 34 }}>
          <div className="card featureTile"><div className="featureIcon">📂</div><h3>IGC Upload & Analyse</h3><p className="muted">Serverseitige Validierung, Hashing und persistente Speicherung.</p></div>
          <div className="card featureTile"><div className="featureIcon">🌡️</div><h3>Thermikanalyse</h3><p className="muted">Erkennung von Steigphasen und Aufwindzonen aus Trackdaten.</p></div>
          <div className="card featureTile"><div className="featureIcon">🔐</div><h3>Multi-User & Keycloak</h3><p className="muted">OIDC-Anmeldung über zentralen Keycloak Realm „flightclub“.</p></div>
        </section>

        <div className="card">
          <div className="cardHead"><span className="cardTitle">🕐 Aktuelle Flüge</span><Link className="muted" href="/flights">Alle ansehen →</Link></div>
          <div className="cardBody grid grid3">
            {recent.length === 0 ? <p className="muted">Noch keine Flüge vorhanden.</p> : recent.map((f: any) => (
              <Link key={f.id} className="card featureTile" href={`/flights/${f.id}`}>
                <strong>{f.title}</strong>
                <p className="muted">{f.pilotCallsign} · {f.simulator}</p>
                <p><strong>{Math.round(f.distanceKm)} km</strong> · {Math.round(f.olcPoints)} OLC · {Math.round(f.avgSpeedKmh)} km/h</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
