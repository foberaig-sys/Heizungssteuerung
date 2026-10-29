# Heizung – native iOS-App für die M-TEC Wärmepumpe (KEBA-Regler)

Ersetzt die Web-Oberfläche (WebHMI) durch eine echte SwiftUI-App. Die App spricht direkt mit derselben
JSON-Schnittstelle, die auch die WebHMI im Browser benutzt (siehe [docs/API.md](docs/API.md)).

## Funktionen

- Übersicht: Außentemperatur, Betriebsart der Anlage, alle Heizkreise und das Warmwasser
- Pfeiltasten ▲▼ wie auf der HMI (Korrektur ±0,5 K)
- Heizkreis: Betriebsart (Aus/Auto/Komfort/Absenkung), Komfort- und Absenktemperatur
- Warmwasser: Betriebsart (inkl. „Einmal aufheizen“) und Solltemperatur
- Anlagen-Betriebsart: Standby / nur Warmwasser / Heizen
- Automatische Aktualisierung alle 30 s, Pull-to-Refresh

## Verbindung

| Modus | Wie | Wann |
|---|---|---|
| **KEBA Fernzugriff** | Du meldest dich in der App einmal bei `remote.keba.com/app` an und tippst auf „WebHmi“ → „WWW“. Die App übernimmt dann die Sitzung und zeigt die native Oberfläche. iOS kann das Passwort automatisch ausfüllen. | funktioniert sofort, überall |
| **Heimnetz / VPN** | IP-Adresse des Reglers eintragen (Router → Geräteliste, z. B. `192.168.1.50`) | schneller, ohne Hersteller-Portal. Unterwegs per eigenem VPN (FRITZ!Box, WireGuard, Tailscale) |

Die Fernzugriff-Sitzung läuft nach einiger Zeit ab. Dann zeigt die App „Sitzung abgelaufen“ und du meldest
dich mit einem Tipp neu an.

## Bauen und aufs iPhone bringen

Voraussetzungen: Mac mit Xcode 15 oder neuer, iPhone mit iOS 17 oder neuer.

```bash
brew install xcodegen
```

```bash
xcodegen generate
```

```bash
open Heizung.xcodeproj
```

In Xcode beim Target *Heizung* unter **Signing & Capabilities** dein Team (Apple-ID) auswählen und die
Bundle-ID ggf. anpassen (z. B. `de.deinname.heizung`). Dann iPhone anschließen und ▶︎ drücken.
Mit einer kostenlosen Apple-ID läuft die App 7 Tage, danach einfach erneut aus Xcode installieren.

## Projektstruktur

```
App/                SwiftUI-App (Views, Zustand, Einstellungen, Web-Login für den Fernzugriff)
KebaKit/            Swift-Package: API-Client, Variablennamen, Datenmodell (+ Unit-Tests)
tools/keba.py       Kommandozeilen-Tool zum Testen der Schnittstelle vom PC
docs/API.md         Dokumentation der Regler-Schnittstelle
project.yml         XcodeGen-Projektbeschreibung
```

Unit-Tests des API-Clients (auf dem Mac):

```bash
cd KebaKit && swift test
```

## Schnittstelle vom PC testen

Im Heimnetz:

```bash
python3 tools/keba.py --url http://192.168.1.50 status
```

Über den Fernzugriff: Port und Cookie-Header aus dem Browser übernehmen (F12 → Netzwerk → beliebige
`readWriteVars`-Anfrage → Request-Header `Cookie`):

```bash
python3 tools/keba.py --url https://remote.keba.com:58841 --cookie 'GM_…=…; JSESSIONID=…' status
```

## Hinweise

- Betriebsarten-Werte stammen aus [keba_keenergy_api](https://github.com/superbox-dev/keba_keenergy_api) und
  passen zu den Icons der HMI. Bitte nach dem ersten Umschalten an der Heizung kontrollieren.
- Cookies und Sitzungsdaten nie öffentlich teilen: Damit kann jeder die Heizung steuern, solange die
  Sitzung gültig ist.
