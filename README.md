# Printer Farm Admin

Webbasierte Admin-App fuer kleine bis mittlere 3D-Druckerfarmen mit SQLite-Datenbank.

Aktuelle App-Version: `0.0.17a`

## Module

- Uebersicht: Materialbestand im Lager und Status der verbundenen Drucker.
- Materialverwaltung: Material kompakt als Liste mit Typ, Farbe, Hersteller, Menge, Lagerplatz, Bearbeitung, schneller Bestandsaenderung und Loeschaktion verwalten.
- Lagerplaetze: Lagerorte kompakt als Liste mit Raum, Regal, Box, Notiz, Materialanzahl, Bearbeitung und Loeschaktion verwalten.
- Einstellungen: User kompakt als Liste verwalten, inklusive Anlegen, Bearbeiten, Passwort, Rechtegruppe und Loeschen mit zweiter Bestaetigung.
- Anmeldung: User melden sich mit User-Name und Passwort an; der Abmelden-Tab beendet die Sitzung nach Bestaetigung.

## Start

```bash
node src/server.js
```

Danach ist die App unter `http://localhost:3000` erreichbar.

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
