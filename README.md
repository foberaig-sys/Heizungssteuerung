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
| **Modbus** (empfohlen) | IP-Adresse der Wärmepumpe (Display → Netzwerk → LAN, z. B. `192.168.0.100`). Direkt, ohne Website, ohne Passwort. Braucht die eigene App-Version (siehe unten). | im WLAN zuhause oder per VPN |
| **KEBA Fernzugriff** | Einmal in den Einstellungen Benutzername und Passwort von `remote.keba.com` eintragen. Ab dann meldet sich die App bei jedem Start **unsichtbar selbst** an und öffnet die Anlage – du siehst keine Webseite, nur die App. | funktioniert überall |

So funktioniert der Fernzugriff technisch: Die App öffnet eine unsichtbare WebView, meldet sich darin im
Secomea-Portal an, klappt die Anlage auf, tippt „WebHmi“ und „WWW“ an
([src/keba/portalAutomation.ts](src/keba/portalAutomation.ts)). Sobald die HMI offen ist, schickt die
App ihre Anfragen über diese WebView an den Regler ([src/keba/bridge.ts](src/keba/bridge.ts)) und zeigt
die Werte in der eigenen Oberfläche. Läuft der Tunnel ab, verbindet sie sich still neu.

Klappt die Automatik einmal nicht (z. B. weil KEBA das Portal ändert), zeigt die App die Portal-Seite
mit einem Hinweis, damit du dich wie gewohnt von Hand verbinden kannst.

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

Hinweis: Snack/Expo Go reichen für Modbus nicht (keine TCP-Verbindungen). Für den Alltag die eigene
App-Version bauen (Abschnitt 2).

## 2. Eigene App-Version – nötig für Modbus

Modbus (direkt im Heimnetz, ohne Website und ohne Passwort) braucht eine direkte TCP-Verbindung. Die gibt es
in Expo Go/Snack nicht, sondern nur in einer eigenen App-Version. Gebaut wird in der Cloud von Expo (EAS),
ein Mac ist nicht nötig, wohl aber ein **Apple Developer Konto**.

1. In [app.json](app.json) `ios.bundleIdentifier` ist auf `at.oberaigner.heizung` gesetzt (bei Bedarf ändern).
2. Kostenloses Konto auf <https://expo.dev> anlegen und anmelden:

```bash
npx eas-cli@latest login
```

3. Das iPhone einmal für Test-Apps registrieren (Link öffnen, Profil installieren):

```bash
npx eas-cli@latest device:create
```

4. App bauen (dauert ca. 15–20 Minuten, EAS fragt nach dem Apple-Konto und richtet Zertifikate selbst ein):

```bash
npx eas-cli@latest build -p ios --profile preview
```

Am Ende kommt ein Link/QR-Code, über den sich die App direkt aufs iPhone installieren lässt.

Später für den App Store bzw. TestFlight:

```bash
npx eas-cli@latest build -p ios --profile production
```

```bash
npx eas-cli@latest submit -p ios --latest
```

## Projektstruktur

```
src/app/                Routen (Expo Router): echte iOS-Tab-Leiste mit Liquid Glass, Start-Stack
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
