import { auth } from "@/auth";
import { signOutWithKeycloak } from "@/app/auth-actions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { saveProfileAction } from "./save-profile-action";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProfilePage() {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar profile auth session could not be loaded:", error);
  }
  if (!session?.user?.id) redirect("/login");

  const [profile, flights] = await Promise.all([
    prisma.pilotProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.flight.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  return (
    <main className="wrap" style={{ maxWidth: 960 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cardHead"><span className="cardTitle">Mein Profil</span>
        </div>
        <form className="cardBody" action={saveProfileAction}>
          <div className="formGrid">
            <div className="formGroup"><label>Callsign *</label><input name="callsign" defaultValue={profile?.callsign ?? ""} required /></div>
            <div className="formGroup"><label>Heimatflugplatz</label><input name="homeAirfield" defaultValue={profile?.homeAirfield ?? ""} /></div>
            <div className="formGroup"><label>Lieblings-Simulator</label><select name="favoriteSim" defaultValue={profile?.favoriteSim ?? "MSFS 2024"}><option>MSFS 2024</option><option>MSFS 2020</option><option>Condor 2</option><option>X-Plane 12</option></select></div>
            <div className="formGroup"><label>Lieblingsflugzeug</label><input name="favoriteGlider" defaultValue={profile?.favoriteGlider ?? ""} /></div>
            <div className="formGroup"><label>Land</label><input name="country" defaultValue={profile?.country ?? ""} /></div>
            <div className="formGroup full checkboxGroup">
              <label>
                <input
                  type="checkbox"
                  name="showHomeAirfieldOnHome"
                  defaultChecked={profile?.showHomeAirfieldOnHome ?? false}
                />
                Heimatflugplatz auf der Startseiten-Karte bevorzugen
              </label>
              <p className="muted">Wenn aktiviert, zeigt die Startseite zuerst deinen Heimatflugplatz. Andernfalls wird zuerst der Browser-Standort angefragt.</p>
            </div>
            <div className="formGroup full"><label>Über mich</label><textarea name="bio" defaultValue={profile?.bio ?? ""} /></div>
          </div>
          <p><button className="btn btnSuccess" type="submit">✓ Profil speichern</button></p>
        </form>
      </div>

      <div className="card">
        <div className="cardHead"><span className="cardTitle">Meine Flüge</span></div>
        <div className="cardBody grid grid2">
          {flights.length === 0 ? <p className="muted">Noch keine Flüge hochgeladen.</p> : flights.map((f: any) => (
            <Link className="card featureTile" key={f.id} href={`/flights/${f.id}`}>
              <strong>{f.title}</strong>
              <p className="muted">{f.simulator} · {f.visibility}</p>
              <p>{Math.round(f.distanceKm)} km · {Math.round(f.olcPoints)} OLC</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
