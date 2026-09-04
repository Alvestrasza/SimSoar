import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {getTranslations, setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function ClubsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Clubs"});
  const clubs = await prisma.club.findMany({
    orderBy: {name: "asc"},
    include: {
      memberships: {
        include: {
          user: {
            select: {
              flights: {
                where: {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null},
                select: {distanceKm: true, olcPoints: true}
              }
            }
          }
        }
      }
    }
  });

  return <main className="wrap">
    <section className="card">
      <div className="cardHead"><div><span className="cardTitle">{t("title")}</span><p className="muted">{t("subtitle")}</p></div></div>
      <div className="cardBody clubGrid">
        {clubs.length === 0 ? <p className="muted">{t("empty")}</p> : clubs.map((club) => {
          const flights = club.memberships.flatMap((membership) => membership.user.flights);
          const distance = flights.reduce((sum, flight) => sum + flight.distanceKm, 0);
          const points = flights.reduce((sum, flight) => sum + flight.olcPoints, 0);
          return <article className="card clubCard" key={club.id}>
            <h2><Link href={`/clubs/${club.slug}`}>{club.name}</Link></h2>
            <p className="muted">{club.description || t("noDescription")}</p>
            <div className="clubStats">
              <span>{t("memberCount", {count: club.memberships.length})}</span>
              <span>{t("flightCount", {count: flights.length})}</span>
              <span>{Math.round(distance)} km</span>
              <span>{Math.round(points)} OLC</span>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
