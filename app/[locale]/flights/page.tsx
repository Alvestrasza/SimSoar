import {prisma} from "@/lib/db";
import FlightsExplorer from "@/app/components/FlightsExplorer";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {auth} from "@/auth";
import {Link} from "@/i18n/navigation";
import {
  buildFlightWhere,
  hasActiveFlightFilters,
  parseFlightFilters,
  type FlightFilterInput
} from "@/lib/flight-filters";

export const dynamic = "force-dynamic";

type FlightsPageProps = {
  params: Promise<{locale: string}>;
  searchParams?: Promise<FlightFilterInput> | FlightFilterInput;
};

function leaderboardPreferenceToFilter(
  value: "ALL" | "MSFS" | "CONDOR" | "XPLANE" | null | undefined
) {
  if (value === "MSFS") return "msfs";
  if (value === "CONDOR") return "condor";
  if (value === "XPLANE") return "xplane";
  return "all";
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const filterKeys = [
  "search",
  "simulator",
  "glider",
  "competitionClass",
  "dateFrom",
  "dateTo",
  "distanceMin",
  "distanceMax",
  "pointsMin",
  "pointsMax",
  "speedMin",
  "speedMax",
  "altitudeMin",
  "altitudeMax"
] as const;

function simulatorFilterHref(
  queryParams: FlightFilterInput,
  simulator: string | null
) {
  const params = new URLSearchParams();

  for (const key of filterKeys) {
    const value = firstValue(queryParams[key]);
    if (value) params.set(key, value);
  }

  if (simulator) {
    params.set("simulator", simulator);
  } else {
    params.delete("simulator");
  }

  const query = params.toString();
  return query ? `/flights?${query}` : "/flights";
}

function activeSimulatorFilter(simulator: string) {
  const normalized = simulator.toLowerCase();
  if (normalized.includes("msfs")) return "msfs" as const;
  if (normalized.includes("condor")) return "condor" as const;
  if (normalized.includes("x-plane")) return "xplane" as const;
  return "all" as const;
}

export default async function FlightsPage({
  params,
  searchParams
}: FlightsPageProps) {
  const {locale} = await params;

  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: "Flights"});
  const queryParams = searchParams ? await searchParams : {};
  const explicitAllSimulators = firstValue(queryParams.simulator) === "all";
  const filterInput = explicitAllSimulators
    ? {...queryParams, simulator: ""}
    : queryParams;
  const filters = parseFlightFilters(filterInput);

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar flights auth session could not be loaded:", error);
  }

  const preferences = session?.user?.id
    ? await prisma.userPreference.findUnique({
        where: {
          userId: session.user.id
        },
        select: {
          preferredLeaderboardView: true
        }
      })
    : null;

  if (!explicitAllSimulators && !hasActiveFlightFilters(filters)) {
    const preferredFilter = leaderboardPreferenceToFilter(
      preferences?.preferredLeaderboardView
    );

    if (preferredFilter === "msfs") filters.simulator = "MSFS";
    if (preferredFilter === "condor") filters.simulator = "Condor";
    if (preferredFilter === "xplane") filters.simulator = "X-Plane";
  }

  const flights = await prisma.flight.findMany({
    where: buildFlightWhere(filters),
    orderBy: [{olcPoints: "desc"}, {distanceKm: "desc"}],
    take: 100,
    include: {
      track: {
        orderBy: {seq: "asc"},
        take: 220
      }
    }
  });

  return (
    <main className="wrap">
      <div className="sectionHead">
        <span className="cardTitle">{t("pageTitle")}</span>
      </div>

      <section className="card" style={{marginBottom: 22}}>
        <div className="cardHead">
          <span className="cardTitle">{t("advancedFilters")}</span>
          <span className="muted">{t("resultCount", {count: flights.length})}</span>
        </div>

        <form className="cardBody" method="get">
          <div className="formGrid">
            <div className="formGroup full">
              <label htmlFor="flight-search">{t("searchPilot")}</label>
              <input
                id="flight-search"
                name="search"
                defaultValue={firstValue(queryParams.search)}
                placeholder={t("searchPilotPlaceholder")}
              />
            </div>

            <div className="formGroup">
              <label htmlFor="flight-simulator">{t("filterSimulator")}</label>
              <input id="flight-simulator" name="simulator" defaultValue={filters.simulator} />
            </div>

            <div className="formGroup">
              <label htmlFor="flight-glider">{t("filterGlider")}</label>
              <input id="flight-glider" name="glider" defaultValue={filters.glider} />
            </div>

            <div className="formGroup">
              <label htmlFor="flight-class">{t("filterCompetitionClass")}</label>
              <input id="flight-class" name="competitionClass" defaultValue={filters.competitionClass} />
            </div>

            <div className="formGroup">
              <label>{t("filterDateRange")}</label>
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
                <input type="date" name="dateFrom" aria-label={t("from")} defaultValue={firstValue(queryParams.dateFrom)} />
                <input type="date" name="dateTo" aria-label={t("to")} defaultValue={firstValue(queryParams.dateTo)} />
              </div>
            </div>

            {[
              ["distance", "distanceMin", "distanceMax"],
              ["points", "pointsMin", "pointsMax"],
              ["speed", "speedMin", "speedMax"],
              ["altitude", "altitudeMin", "altitudeMax"]
            ].map(([label, minName, maxName]) => (
              <div className="formGroup" key={label}>
                <label>{t(`filter_${label}`)}</label>
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
                  <input type="number" min="0" step="any" name={minName} aria-label={t("from")} placeholder={t("from")} defaultValue={firstValue(queryParams[minName])} />
                  <input type="number" min="0" step="any" name={maxName} aria-label={t("to")} placeholder={t("to")} defaultValue={firstValue(queryParams[maxName])} />
                </div>
              </div>
            ))}
          </div>

          <div style={{display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20}}>
            <button className="btn btnSuccess" type="submit">{t("applyFilters")}</button>
            <Link className="btn btnSecondary" href="/flights">{t("clearFilters")}</Link>
          </div>
        </form>
      </section>

      <FlightsExplorer
        activeFilter={
          explicitAllSimulators
            ? "all"
            : activeSimulatorFilter(filters.simulator)
        }
        filterLinks={{
          all: simulatorFilterHref(queryParams, "all"),
          msfs: simulatorFilterHref(queryParams, "MSFS"),
          condor: simulatorFilterHref(queryParams, "Condor"),
          xplane: simulatorFilterHref(queryParams, "X-Plane")
        }}
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
          track: f.track.map((p: any) => ({
            lat: p.lat,
            lon: p.lon,
            altM: p.altM
          }))
        }))}
      />
    </main>
  );
}
