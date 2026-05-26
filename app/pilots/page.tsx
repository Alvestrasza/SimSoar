import { prisma } from "@/lib/db";

export default async function PilotsPage() {
  const profiles = await prisma.pilotProfile.findMany({
    include: {
      user: {
        include: {
          flights: {
            where: { visibility: "PUBLIC" },
            select: { distanceKm: true, olcPoints: true, simulator: true }
          }
        }
      }
    }
  });

  const pilots = profiles.map((p) => {
    const flights = p.user.flights;
    const totalOlc = flights.reduce((s, f) => s + f.olcPoints, 0);
    const totalDistance = flights.reduce((s, f) => s + f.distanceKm, 0);
    const bestDistance = Math.max(0, ...flights.map((f) => f.distanceKm));
    return { ...p, flightsCount: flights.length, totalOlc, totalDistance, bestDistance };
  }).sort((a, b) => b.totalOlc - a.totalOlc);

  return (
    <main className="wrap">
      <section className="card">
        <div className="cardHead"><span className="cardTitle">👨‍✈️ Pilot-Rangliste</span></div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>#</th><th>Pilot</th><th>Flüge</th><th>Gesamtstrecke</th><th>Beste Strecke</th><th>Gesamt OLC</th><th>Lieblings-Sim</th></tr></thead>
            <tbody>
              {pilots.map((p, i) => (
                <tr key={p.id}>
                  <td><strong>{i + 1}</strong></td>
                  <td>{p.callsign}</td>
                  <td>{p.flightsCount}</td>
                  <td>{Math.round(p.totalDistance)} km</td>
                  <td>{Math.round(p.bestDistance)} km</td>
                  <td>{Math.round(p.totalOlc)}</td>
                  <td>{p.favoriteSim ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
