import { prisma } from "@/lib/db";
import FlightsExplorer from "@/app/components/FlightsExplorer";

export const dynamic = "force-dynamic";

export default async function FlightsPage() {
  const flights = await prisma.flight.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: [{ olcPoints: "desc" }, { distanceKm: "desc" }],
    take: 100,
    include: { track: { orderBy: { seq: "asc" }, take: 220 } }
  });

  return (
    <main className="wrap">
      <div className="sectionHead"><span className="cardTitle">🏆 Bestenliste – Virtuelle Flüge</span></div>
      <FlightsExplorer
        flights={flights.map((f: any) => ({
          id: f.id,
          title: f.title,
          pilotCallsign: f.pilotCallsign,
          simulator: f.simulator,
          glider: f.glider,
          registration: f.registration,
          distanceKm: f.distanceKm,
          olcPoints: f.olcPoints,
          avgSpeedKmh: f.avgSpeedKmh,
          maxVarioMs: f.maxVarioMs,
          durationSeconds: f.durationSeconds,
          createdAt: f.createdAt.toISOString(),
          track: f.track.map((p: any) => ({ lat: p.lat, lon: p.lon, altM: p.altM }))
        }))}
      />
    </main>
  );
}
