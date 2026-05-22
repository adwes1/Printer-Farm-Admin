# Printer Farm Admin

Webbasierte Admin-App fuer kleine bis mittlere 3D-Druckerfarmen mit SQLite-Datenbank.

Aktuelle App-Version: `0.0.24a`

## Module

- Uebersicht: Materialbestand inklusive Ampel im Lager und Status der verbundenen Drucker.
- Materialverwaltung: Material kompakt als Liste mit Typ, Farbe, Hersteller, Ampel, Menge, Lagerplatz, Bearbeitung, schneller Bestandsaenderung und Loeschaktion verwalten.
- Lagerplaetze: Lagerorte kompakt als Liste mit Raum, Regal, Box, Notiz, Materialanzahl, Bearbeitung und Loeschaktion verwalten.
- 3D-Drucker: Bambu Lab Drucker lokal per MQTT registrieren, testen und den letzten Status im Dashboard anzeigen.
- Einstellungen: User kompakt als Liste verwalten und Material-Ampel-Grenzwerte bearbeiten.
- Anmeldung: User melden sich mit User-Name und Passwort an; der Abmelden-Tab beendet die Sitzung nach Bestaetigung.

## Start

```bash
node src/server.js
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## Start mit Docker Compose

```bash
docker compose up -d --build
```

Danach ist die App unter `http://localhost:3000` erreichbar. Die SQLite-Datenbank bleibt im lokalen Ordner `data/` erhalten und wird in den Container nach `/data` gemountet.

Nuetzliche Befehle:

```bash
docker compose logs -f
docker compose restart
docker compose down
```

## Startup-Prozess

Beim Start fuehrt die App automatisch den Bootstrap aus:

1. Prueft, ob eine Installation unter `data/install.json` existiert.
2. Prueft die Verbindung zur SQLite-Datenbank.
3. Legt die Migrationstabelle an, falls sie fehlt.
4. Fuehrt noch nicht angewendete SQL-Migrationen aus `src/db/migrations` aus.
5. Schreibt oder aktualisiert die Installationsmetadaten.

Dieser Ablauf ist auch die Basis fuer spaetere Updates: neue Migrationen werden beim naechsten Start erkannt und angewendet.

## Konfiguration

Die Grundkonfiguration fuer Deployments liegt in `config.php` im Projektroot. Dort werden Datenbankdatei, Installationsdatei und der erste Admin-User inklusive Passwort und E-Mail gesetzt:

```php
'db_path' => 'data/printer-farm.sqlite',
'install_file' => 'data/install.json',
'admin_name' => 'admin',
'admin_email' => 'admin@example.local',
'admin_password' => 'admin',
```

Beim Start liest die Node-App diese Datei ein. Relative Pfade werden vom Projektroot aus aufgeloest. Umgebungsvariablen ueberschreiben weiterhin die Werte aus `config.php`.

Optionale Umgebungsvariablen:

- `PORT`: Webserver-Port, Standard `3000`
- `HOST`: Webserver-Host, Standard `127.0.0.1`
- `DB_PATH`: Pfad zur SQLite-Datei, Standard `data/printer-farm.sqlite`
- `INSTALL_FILE`: Pfad zur Installationsdatei, Standard `data/install.json`
- `ADMIN_NAME`: Name des ersten Admin-Users
- `ADMIN_EMAIL`: E-Mail des ersten Admin-Users
- `ADMIN_PASSWORD`: Passwort des ersten Admin-Users

## Bambu Lab Drucker einrichten

Die Phase-1-Integration ist Monitoring-only. Die App verbindet sich lokal im LAN per MQTT und sendet keine Druck-, Pause-, Stop-, Firmware-, Upload- oder Cloud-Befehle.

1. Drucker ins gleiche LAN wie den Webserver bringen.
2. Feste IP oder DHCP-Reservierung vergeben.
3. Am Drucker LAN Mode / Developer Mode aktivieren, falls erforderlich.
4. Seriennummer notieren.
5. LAN Access Code / Access Code notieren.
6. Drucker im Tab `3D-Drucker` anlegen.
7. Verbindung mit `Testen` pruefen.
8. Dashboard auf Online/Offline, Fortschritt, Temperaturen, Layer und Datei pruefen.

Unterstuetzte Modelle in der Registry: `P1S`, `X1C`, `H2D`, `unknown`. H2D und unbekannte Firmware-Payloads werden defensiv normalisiert: fehlende Felder werden als `null` gespeichert und in der UI als `–` angezeigt.

MQTT-Verbindungsparameter:

- Host: IP-Adresse des Druckers
- Port: `8883`
- TLS: ja
- Username: `bblp`
- Password: LAN Access Code / Access Code
- Topic: `device/<SERIAL>/report`
- Zertifikat: lokale Bambu-Zertifikate werden mit `rejectUnauthorized: false` akzeptiert

Manueller Test mit `mosquitto_sub`:

```bash
mosquitto_sub \
  -h <DRUCKER_IP> \
  -p 8883 \
  -u bblp \
  -P "<ACCESS_CODE>" \
  -t "device/<SERIAL>/report" \
  --insecure
```

Access Codes werden nicht im Frontend ausgeliefert und nicht geloggt. In dieser Projektphase gibt es noch keine Secret Encryption; das Feld `access_code` wird in SQLite gespeichert und ist fuer spaetere Verschluesselung bewusst isoliert.

Raw-MQTT-Payloads werden standardmaessig in `printer_status.raw_json` gespeichert, damit unbekannte Felder spaeter ausgewertet werden koennen. Das kann ueber `app_settings.bambu_store_raw_payloads = 0` deaktiviert werden.

## API fuer Drucker

- `GET /api/printers`: alle Drucker inklusive letztem Status, ohne Access Codes
- `GET /api/printers/:id`: Drucker-Details inklusive letztem Status, ohne Access Code
- `POST /api/printers`: Drucker anlegen
- `PATCH /api/printers/:id`: Drucker bearbeiten
- `DELETE /api/printers/:id`: Drucker inklusive Statushistorie loeschen
- `POST /api/printers/:id/test-connection`: MQTT-Verbindung bis zu 10 Sekunden testen
- `GET /api/printers/:id/status-history?from=&to=&limit=`: Statushistorie fuer Diagramme
- `GET /api/printer-events`: Server-Sent Events fuer Live-Updates

## Tests

```bash
npm test
```

Die Normalizer-Tests nutzen Mock-Fixtures fuer:

- P1S waehrend eines Drucks
- X1C im Idle-Zustand
- H2D/unbekannter Payload mit fehlenden Feldern
