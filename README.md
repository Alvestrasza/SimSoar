# SimSoar – Multi-User Virtual Gliding Portal

<!--
doc_type: Installation Documentation
template_version: v0.1.0
document_version: v0.1.1
created: 2026-05-14
last_updated: 2026-05-14
status: Draft
classification: Internal
owner: FlightClub / Alvestrasza Corporation
technical_owner: Internal IT
service_area: simsoar / flightclub
system_scope: Next.js, Keycloak, PostgreSQL, IGC upload and analysis
review_cycle: 6 months
ai_readable: true
source_of_truth: Git / Wiki.js
language: de-DE
-->

## 1. Zweck

Dieses Projekt migriert die vorhandene einzelne `index.html` in ein robustes Multi-User-Grundgerüst auf Basis von Next.js App Router, Auth.js/Keycloak, Prisma und PostgreSQL.

Diese Variante ist ausdrücklich **ohne Docker** vorbereitet und kann klassisch auf einem Ubuntu Server mit Node.js, systemd, NGINX und PostgreSQL betrieben werden.

## 2. Zielarchitektur

```text
Internet
  → Sophos WAF / TLS Termination
  → SimSoar Webserver in DMZ
  → Next.js App auf localhost:3000
  → PostgreSQL in Services
  → Keycloak Realm: flightclub
  → Upload Storage: /var/lib/simsoar/uploads
```

## 3. Enthaltene Funktionen

- Keycloak/OIDC Login über Auth.js
- Benutzerprofile mit Callsign
- IGC Upload mit serverseitiger Prüfung
- IGC Parser mit Strecke, Höhenprofil-Basisdaten, Vario und Thermikerkennung
- Persistenz in PostgreSQL via Prisma
- öffentliche Bestenliste
- persönliche Flugliste
- vorbereitet für Leaflet-Kartenintegration
- systemd-Servicevorlage
- optionale NGINX-Reverse-Proxy-Vorlage

## 4. Voraussetzungen

- Ubuntu Server 24.04 LTS oder 22.04 LTS
- Node.js 22 LTS
- npm
- Zugriff auf PostgreSQL
- Keycloak Realm `flightclub`
- Sophos WAF oder anderer Reverse Proxy für externen HTTPS-Zugriff

## 5. Keycloak Client

Empfohlene Einstellungen:

```text
Realm: flightclub
Client ID: simsoar
Client Type: OpenID Connect
Client Authentication: On / Confidential
Valid Redirect URI: https://simsoar.example.com/api/auth/callback/keycloak
Web Origins: https://simsoar.example.com
```

## 6. Installation ohne Docker

### 6.1 System vorbereiten

```bash
sudo bash scripts/install-ubuntu-systemd.sh
```

### 6.2 Anwendung nach `/opt/simsoar` kopieren

```bash
sudo rsync -a --delete ./ /opt/simsoar/
sudo chown -R simsoar:simsoar /opt/simsoar
```

### 6.3 Environment-Datei erstellen

```bash
sudo mkdir -p /etc/simsoar
sudo cp /opt/simsoar/.env.example /etc/simsoar/simsoar.env
sudo nano /etc/simsoar/simsoar.env
sudo chown root:simsoar /etc/simsoar/simsoar.env
sudo chmod 640 /etc/simsoar/simsoar.env
```

Wichtige Werte:

```text
NEXTAUTH_URL=https://simsoar.example.com
AUTH_SECRET=<openssl-rand-base64-32>
AUTH_KEYCLOAK_ID=simsoar
AUTH_KEYCLOAK_SECRET=<keycloak-client-secret>
AUTH_KEYCLOAK_ISSUER=https://login.academy.alvestrasza.com/realms/flightclub
DATABASE_URL=postgresql://simsoar_app:<password>@<pgsql-fqdn>:5432/simsoar?schema=public
UPLOAD_DIR=/var/lib/simsoar/uploads
SERVER_ACTION_ALLOWED_ORIGINS=simsoar.example.com
```

Secret erzeugen:

```bash
openssl rand -base64 32
```

### 6.4 Abhängigkeiten installieren und Build erstellen

```bash
cd /opt/simsoar
sudo -u simsoar npm ci
sudo -u simsoar npx prisma generate
sudo -u simsoar npx prisma migrate deploy
sudo -u simsoar npm run build
```

### 6.5 systemd-Service aktivieren

```bash
sudo cp /opt/simsoar/deploy/systemd/simsoar.service /etc/systemd/system/simsoar.service
sudo systemctl daemon-reload
sudo systemctl enable simsoar
sudo systemctl start simsoar
sudo systemctl status simsoar
```

### 6.6 Optional: lokales NGINX aktivieren

Nur verwenden, wenn der Host selbst zusätzlich einen lokalen Reverse Proxy benötigt.

```bash
sudo cp /opt/simsoar/deploy/nginx/simsoar.conf /etc/nginx/sites-available/simsoar.conf
sudo ln -s /etc/nginx/sites-available/simsoar.conf /etc/nginx/sites-enabled/simsoar.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Betrieb

### Dienststatus

```bash
systemctl status simsoar
journalctl -u simsoar -f
```

### Neustart

```bash
sudo systemctl restart simsoar
```

### Update / neuer Build

```bash
cd /opt/simsoar
sudo systemctl stop simsoar
sudo -u simsoar npm ci
sudo -u simsoar npx prisma migrate deploy
sudo -u simsoar npm run build
sudo systemctl start simsoar
```

## 8. Backup

Sichern:

- PostgreSQL Datenbank `simsoar`
- `/var/lib/simsoar/uploads`
- `/etc/simsoar/simsoar.env`
- `/opt/simsoar` oder Git-Repository

## 9. Sicherheit

- `.env` und `/etc/simsoar/simsoar.env` dürfen nicht ins Git-Repository.
- Secrets gehören in den Passwortsafe.
- PostgreSQL darf nicht aus dem Internet erreichbar sein.
- Keycloak Client Secret darf nicht im Wiki stehen.
- Uploadgröße muss zusätzlich auf der WAF begrenzt werden.
- Für Produktivbetrieb sollte ein Virenscan oder Upload-Scanner ergänzt werden.

## 10. Prüfung

```bash
curl -I http://127.0.0.1:3000
curl -I https://simsoar.example.com
systemctl status simsoar
journalctl -u simsoar --no-pager -n 100
```

## 11. Nächste Ausbaustufen

1. Leaflet-Clientkomponente für echte Trackanzeige.
2. Admin-Rollen aus Keycloak Realm Roles.
3. Moderationsworkflow für öffentliche Flüge.
4. Object Storage statt lokalem Upload-Verzeichnis.
5. API-Rate-Limiting und Audit-Logging.
6. Import alter Supabase-Daten, falls gewünscht.

## Patch v0.1.3 - Prisma Authenticator relation

Deployment fix: added the missing `User.authenticators Authenticator[]` back-relation required by Prisma for the Auth.js `Authenticator.user` relation.
