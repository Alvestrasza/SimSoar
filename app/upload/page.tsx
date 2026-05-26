import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { saveFlightAction } from "./save-flight-action";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.pilotProfile.findUnique({ where: { userId: session.user.id } });

  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <div className="card">
        <div className="cardHead">
          <span className="cardTitle">✈️ Flug hochladen</span>
          <span className="muted">Max. 10 MB · .igc</span>
        </div>
        <form className="cardBody" action={saveFlightAction}>
          <div className="dropZone">
            <div style={{ fontSize: 44 }}>📁</div>
            <strong>IGC-Datei auswählen</strong>
            <p className="muted">MSFS 2020/2024, Condor 2 oder X-Plane</p>
            <input name="igc" type="file" accept=".igc" required />
          </div>

          <div className="formGrid" style={{ marginTop: 20 }}>
            <div className="formGroup">
              <label>Pilot / Callsign *</label>
              <input name="pilotCallsign" defaultValue={profile?.callsign ?? ""} required />
            </div>
            <div className="formGroup">
              <label>Simulator *</label>
              <select name="simulator" defaultValue={profile?.favoriteSim ?? "MSFS 2024"}>
                <option>MSFS 2024</option><option>MSFS 2020</option><option>Condor 2</option><option>X-Plane 12</option><option>X-Plane 11</option><option>DCS World</option><option>Sonstiger</option>
              </select>
            </div>
            <div className="formGroup"><label>Kennzeichen</label><input name="registration" placeholder="z. B. D-KXYZ" /></div>
            <div className="formGroup"><label>Segelflugzeug</label><input name="glider" placeholder="wird aus IGC ergänzt, falls leer" /></div>
            <div className="formGroup"><label>Wettbewerbs-Klasse</label><select name="competitionClass"><option>Club Klasse</option><option>15 m Klasse</option><option>18 m Klasse</option><option>Offene Klasse</option><option>Doppelsitzer</option></select></div>
            <div className="formGroup"><label>Sichtbarkeit</label><select name="visibility"><option value="PUBLIC">Öffentlich</option><option value="PRIVATE">Privat</option><option value="UNLISTED">Nicht gelistet</option></select></div>
            <div className="formGroup full"><label>Kommentar</label><textarea name="comment" placeholder="Besondere Momente, Streckenentscheidungen…" /></div>
          </div>

          <p style={{ marginTop: 20 }}>
            <button className="btn btnSuccess" type="submit">🚀 Flug einreichen</button>
          </p>
        </form>
      </div>
    </main>
  );
}
