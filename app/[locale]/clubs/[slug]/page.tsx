import {Link} from "@/i18n/navigation";
import {prisma} from "@/lib/db";
import {clubRanking} from "@/lib/club-policy";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClubPage({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: "Clubs"});
  const club = await prisma.club.findUnique({
    where: {slug},
    include: {
      memberships: {
        orderBy: [{role: "desc"}, {joinedAt: "asc"}],
        include: {
          user: {
            select: {
              id: true,
              profile: {select: {callsign: true}},
              flights: {
                where: {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null},
                orderBy: {createdAt: "desc"},
                select: {id: true, title: true, distanceKm: true, olcPoints: true, simulator: true, createdAt: true}
              }
            }
          }
        }
      }
    }
  });
  if (!club) notFound();

  const ranking = clubRanking(club.memberships.map((membership) => ({
    userId: membership.user.id,
    callsign: membership.user.profile?.callsign || t("unnamedPilot"),
    role: membership.role,
    hasProfile: Boolean(membership.user.profile),
    flights: membership.user.flights
  })));
  const recentFlights = club.memberships.flatMap((membership) => membership.user.flights.map((flight) => ({
    ...flight,
    callsign: membership.user.profile?.callsign || t("unnamedPilot")
  }))).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 20);

  return <main className="wrap">
    <section className="card">
      <div className="cardHead adminFlightsHeader">
        <div><span className="cardTitle">{club.name}</span><p className="muted">{club.description || t("noDescription")}</p></div>
        <Link className="btn btnSecondary" href="/clubs">{t("back")}</Link>
      </div>
    </section>

    <section className="card" style={{marginTop: 20}}>
      <div className="cardHead"><span className="cardTitle">{t("ranking")}</span></div>
      <div className="tableWrap"><table>
        <thead><tr><th>{t("rank")}</th><th>{t("pilot")}</th><th>{t("role")}</th><th>{t("flights")}</th><th>{t("distance")}</th><th>{t("points")}</th></tr></thead>
        <tbody>{ranking.length === 0 ? <tr><td colSpan={6} className="emptyTable">{t("noMembers")}</td></tr> : ranking.map((member, index) => <tr key={member.userId}>
          <td><strong>{index + 1}</strong></td>
          <td>{member.hasProfile ? <Link href={`/pilots/${member.userId}`}>{member.callsign}</Link> : member.callsign}</td>
          <td>{t(`role_${member.role}`)}</td><td>{member.flightsCount}</td><td>{Math.round(member.totalDistanceKm)} km</td><td>{Math.round(member.totalOlcPoints)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <section className="card" style={{marginTop: 20}}>
      <div className="cardHead"><span className="cardTitle">{t("recentFlights")}</span></div>
      <div className="tableWrap"><table>
        <thead><tr><th>{t("date")}</th><th>{t("pilot")}</th><th>{t("flight")}</th><th>{t("simulator")}</th><th>{t("distance")}</th><th>{t("points")}</th></tr></thead>
        <tbody>{recentFlights.length === 0 ? <tr><td colSpan={6} className="emptyTable">{t("noFlights")}</td></tr> : recentFlights.map((flight) => <tr key={flight.id}>
          <td>{flight.createdAt.toLocaleDateString(locale)}</td><td>{flight.callsign}</td><td><Link href={`/flights/${flight.id}`}>{flight.title}</Link></td><td>{flight.simulator}</td><td>{Math.round(flight.distanceKm)} km</td><td>{Math.round(flight.olcPoints)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </main>;
}
