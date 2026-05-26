import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function FlightsPage() {
  const flights = await prisma.flight.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: [{ olcPoints: "desc" }, { distanceKm: "desc" }],
    take: 100
  });

  return (
    <main className="wrap">
      <div className="twoCol">
        <section className="card">
          <div className="cardHead"><span className="cardTitle">🏆 Bestenliste – Virtuelle Flüge</span></div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>#</th><th>Pilot</th><th>Strecke</th><th>OLC</th><th>Ø km/h</th><th>Max ▲</th><th>Simulator</th><th></th></tr>
              </thead>
              <tbody>
                {flights.map((f, i) => (
                  <tr key={f.id}>
                    <td><strong>{i + 1}</strong></td>
                    <td>{f.pilotCallsign}</td>
                    <td>{Math.round(f.distanceKm)} km</td>
                    <td>{Math.round(f.olcPoints)}</td>
                    <td>{Math.round(f.avgSpeedKmh)}</td>
                    <td>{f.maxVarioMs.toFixed(1)} m/s</td>
                    <td><span className="badge">{f.simulator}</span></td>
                    <td><Link className="btn btnSecondary" href={`/flights/${f.id}`}>Details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="grid">
          <div className="card"><div className="cardHead"><span className="cardTitle">ℹ️ Hinweis</span></div><div className="cardBody muted">Filter und Live-Karten sind als nächster Ausbaupunkt vorbereitet. Die Datenbasis ist bereits multi-user-fähig.</div></div>
        </aside>
      </div>
    </main>
  );
}
