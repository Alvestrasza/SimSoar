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
import CollapsibleFilterCard from "@/app/components/CollapsibleFilterCard";

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
  const hasExplicitFilters = filterKeys.some((key) => firstValue(queryParams[key]));
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
        <Link className="btn btnPrimary" href="/flights/compare">{t("compareFlights")}</Link>
      </div>

      <CollapsibleFilterCard
        collapseLabel={t("hideFilters")}
        expandLabel={t("showFilters")}
        initiallyOpen={hasExplicitFilters}
        resultLabel={t("resultCount", {count: flights.length})}
        title={t("advancedFilters")}
      >
        <form className="cardBody compactFilterBody" method="get">
          <div className="formGrid flightFilterGrid">
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
              <select id="flight-simulator" name="simulator" defaultValue={filters.simulator}>
                <option value="">{t("filterAnySimulator")}</option>
                <option value="MSFS">{t("filterAllMsfs")}</option>
                <option value="MSFS 2024">MSFS 2024</option>
                <option value="MSFS 2020">MSFS 2020</option>
                <option value="Condor">{t("filterAllCondor")}</option>
                <option value="Condor 2">Condor 2</option>
                <option value="X-Plane">{t("filterAllXplane")}</option>
                <option value="X-Plane 12">X-Plane 12</option>
                <option value="X-Plane 11">X-Plane 11</option>
                <option value="DCS World">DCS World</option>
                <option value="Other">{t("filterOtherSimulator")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label htmlFor="flight-glider">{t("filterGlider")}</label>
              <input id="flight-glider" name="glider" defaultValue={filters.glider} />
            </div>

            <div className="formGroup">
              <label htmlFor="flight-class">{t("filterCompetitionClass")}</label>
              <select id="flight-class" name="competitionClass" defaultValue={filters.competitionClass}>
                <option value="">{t("filterAnyClass")}</option>
                <option value="Club Klasse">{t("classClub")}</option>
                <option value="15 m Klasse">{t("class15m")}</option>
                <option value="18 m Klasse">{t("class18m")}</option>
                <option value="Offene Klasse">{t("classOpen")}</option>
                <option value="Doppelsitzer">{t("classTwoSeater")}</option>
              </select>
            </div>

            <div className="formGroup">
              <label>{t("filterDateRange")}</label>
              <div className="filterRangeInputs">
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
                <div className="filterRangeInputs">
                  <input type="number" min="0" step="any" name={minName} aria-label={t("from")} placeholder={t("from")} defaultValue={firstValue(queryParams[minName])} />
                  <input type="number" min="0" step="any" name={maxName} aria-label={t("to")} placeholder={t("to")} defaultValue={firstValue(queryParams[maxName])} />
                </div>
              </div>
            ))}
          </div>

          <div className="flightFilterActions">
            <button className="btn btnSuccess" type="submit">{t("applyFilters")}</button>
            <Link className="btn btnSecondary" href="/flights">{t("clearFilters")}</Link>
          </div>
        </form>
      </CollapsibleFilterCard>

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
