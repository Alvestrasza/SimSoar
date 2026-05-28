import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PilotsPageProps = {
  params: Promise<{locale: string}>;
};

type PilotRow = {
  callsign: string;
  flightsCount: number;
  totalDistance: number;
  bestDistance: number;
  totalOlc: number;
  favoriteSim: string | null;
};

type PilotAggregate = {
  callsign: string;
  distances: number[];
  olc: number[];
  simulators: string[];
};

function favoriteSimulator(simulators: string[]) {
  const counts = new Map<string, number>();

  for (const simulator of simulators) {
    counts.set(simulator, (counts.get(simulator) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function getPilots(
  unknownPilot: string,
  loadError: string
): Promise<{pilots: PilotRow[]; error: string | null}> {
  try {
    const flights = await prisma.flight.findMany({
      where: {
        visibility: "PUBLIC"
      },
      select: {
        pilotCallsign: true,
        distanceKm: true,
        olcPoints: true,
        simulator: true
      }
    });

    const pilotMap = new Map<string, PilotAggregate>();

    for (const flight of flights) {
      const callsign = flight.pilotCallsign?.trim() || unknownPilot;

      let entry = pilotMap.get(callsign);

      if (!entry) {
        entry = {
          callsign,
          distances: [],
          olc: [],
          simulators: []
        };

        pilotMap.set(callsign, entry);
      }

      entry.distances.push(flight.distanceKm ?? 0);
      entry.olc.push(flight.olcPoints ?? 0);
      entry.simulators.push(flight.simulator || "–");
    }

    const pilots = [...pilotMap.values()]
      .map((entry) => ({
        callsign: entry.callsign,
        flightsCount: entry.distances.length,
        totalDistance: entry.distances.reduce((sum, value) => sum + value, 0),
        bestDistance: Math.max(0, ...entry.distances),
        totalOlc: entry.olc.reduce((sum, value) => sum + value, 0),
        favoriteSim: favoriteSimulator(entry.simulators)
      }))
      .sort(
        (a, b) =>
          b.totalOlc - a.totalOlc ||
          b.bestDistance - a.bestDistance ||
          a.callsign.localeCompare(b.callsign)
      );

    return {
      pilots,
      error: null
    };
  } catch (error) {
    console.error("SimSoar pilots page failed to load:", error);

    return {
      pilots: [],
      error: loadError
    };
  }
}

export default async function PilotsPage({params}: PilotsPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Pilots"
  });

  const {pilots, error} = await getPilots(
    t("unknownPilot"),
    t("loadError")
  );

  return (
    <main className="wrap">
      <section className="card">
        <div className="cardHead">
          <span className="cardTitle">{t("pageTitle")}</span>
        </div>

        {error ? (
          <div className="cardBody">
            <p className="muted">{error}</p>
          </div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t("rank")}</th>
                  <th>{t("pilot")}</th>
                  <th>{t("flights")}</th>
                  <th>{t("totalDistance")}</th>
                  <th>{t("bestDistance")}</th>
                  <th>{t("totalOlc")}</th>
                  <th>{t("favoriteSim")}</th>
                </tr>
              </thead>

              <tbody>
                {pilots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="emptyTable">
                      {t("noPublicFlights")}
                    </td>
                  </tr>
                ) : (
                  pilots.map((p, i) => (
                    <tr key={p.callsign}>
                      <td>
                        <strong>{i + 1}</strong>
                      </td>
                      <td>{p.callsign}</td>
                      <td>{p.flightsCount}</td>
                      <td>{Math.round(p.totalDistance)} km</td>
                      <td>{Math.round(p.bestDistance)} km</td>
                      <td>{Math.round(p.totalOlc)}</td>
                      <td>{p.favoriteSim ?? "–"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}