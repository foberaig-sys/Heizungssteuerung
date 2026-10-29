# Heizung – App für die M-TEC Wärmepumpe (KEBA-Regler)

Ersetzt die Web-Oberfläche (WebHMI) durch eine richtige App, gebaut mit **Expo / React Native** (SDK 58).
Die App spricht direkt mit derselben JSON-Schnittstelle, die auch die WebHMI im Browser benutzt
(siehe [docs/API.md](docs/API.md)). Kein Mac und kein Xcode nötig.

## Funktionen

- Übersicht: Außentemperatur, Betriebsart der Anlage, alle Heizkreise und das Warmwasser
- Pfeiltasten ▲▼ wie auf der HMI (Korrektur ±0,5 K)
- Heizkreis: Betriebsart (Aus/Auto/Komfort/Absenkung), Komfort- und Absenktemperatur
- Warmwasser: Betriebsart (inkl. „Einmal aufheizen“) und Solltemperatur
- Anlagen-Betriebsart: Standby / nur Warmwasser / Heizen
- Automatische Aktualisierung alle 30 s, Pull-to-Refresh, Hell/Dunkel-Modus

## Verbindung

| Modus | Wie | Wann |
|---|---|---|
| **KEBA Fernzugriff** (Standard) | In der App bei `remote.keba.com/app` anmelden, Anlage aufklappen, „WebHmi“ → „WWW“ antippen. Die Portal-Seite verschwindet, die App zeigt ihre eigene Oberfläche. | funktioniert sofort, überall |
| **Heimnetz / VPN** | IP-Adresse des Reglers eintragen (Router → Geräteliste, z. B. `192.168.1.50`) | schneller, ohne Hersteller-Portal; unterwegs per eigenem VPN |

So funktioniert der Fernzugriff technisch: Die Secomea-Sitzung steckt in Cookies der eingebetteten
WebView. Die App lässt deshalb eine unsichtbare WebView mit der HMI offen und schickt ihre Anfragen
über diese WebView ([src/keba/bridge.ts](src/keba/bridge.ts)). Läuft die Sitzung ab, zeigt die App
„Sitzung abgelaufen“ und du meldest dich mit einem Tipp neu an.

## 1. Testen mit Expo Go (ohne Developer-Konto)

**Expo Go** aus dem App Store aufs iPhone laden. Dann eine der beiden Varianten:

**a) Vom PC aus (empfohlen, am zuverlässigsten).** Node.js 20+ installieren, dann im Projektordner:

```bash
npm install
```

```bash
npx expo start --tunnel
```

Den angezeigten QR-Code mit der iPhone-Kamera scannen, die App öffnet sich in Expo Go.
Änderungen am Code sind sofort auf dem Handy sichtbar.

**b) Mit Snack im Browser (ganz ohne Installation).** Auf <https://snack.expo.dev> → „Import git
repository“ und die URL dieses Repositories eintragen (das Repository muss dafür öffentlich sein).
Alternativ die Dateien `App.tsx`, `app.json`, `package.json` und den Ordner `src/` per Drag & Drop
in einen neuen Snack ziehen. Rechts „My Device“ wählen und den QR-Code mit Expo Go scannen.
Die Vorschau im Browser selbst funktioniert für den Fernzugriff nicht (keine WebView im Web).

## 2. Als normale App installieren (mit Apple Developer Konto)

Gebaut wird in der Cloud von Expo (EAS), ein Mac ist nicht nötig. Kostenloses Konto auf
<https://expo.dev> anlegen, dann:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build -p ios --profile production
```

EAS fragt nach deinem Apple-Konto und richtet Zertifikate und Bundle-ID selbst ein. Vorher in
[app.json](app.json) `ios.bundleIdentifier` auf etwas Eigenes ändern, z. B. `de.deinname.heizung`.

Danach an TestFlight übertragen und dort auf dem iPhone installieren:

```bash
npx eas-cli@latest submit -p ios --latest
```

## Projektstruktur

```
App.tsx                 Einstieg: Navigation, Kopfzeile, Status-Bildschirme
src/keba/               Regler-Schnittstelle: Client, Variablennamen, Zustand, WebView-Bridge (+ Tests)
src/screens/            Übersicht, Heizkreis, Warmwasser, Einstellungen, Fernzugriff-WebView
src/ui/                 Farben und wiederverwendbare Bausteine
src/store.tsx           App-Zustand (Verbindung, Daten, Schreiben)
tools/keba.py           Kommandozeilen-Tool zum Testen der Schnittstelle vom PC
docs/API.md             Dokumentation der Regler-Schnittstelle
```

Prüfen vor Änderungen:

```bash
npm run typecheck
```

```bash
npm test
```

## Schnittstelle vom PC testen

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
