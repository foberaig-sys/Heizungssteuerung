# Schnittstelle des KEBA-Reglers (M-TEC WebHMI)

Ermittelt aus dem Netzwerk-Mitschnitt der WebHMI (`https://remote.keba.com:<Port>`). Abgeglichen mit der
Open-Source-Bibliothek [keba_keenergy_api](https://github.com/superbox-dev/keba_keenergy_api).

Alle Aufrufe sind `POST`-Requests mit `Content-Type: application/json; charset=UTF-8`.

## Basis-URL

| Weg | Basis-URL | Anmeldung |
|---|---|---|
| Heimnetz | `http://<IP-des-Reglers>` | keine, bei neuerer Firmware evtl. HTTP Basic Auth |
| Fernzugriff | `https://remote.keba.com:<Port>`, der Port ändert sich bei jeder Sitzung | Cookies der Secomea-Sitzung (`GM_…_GTA`, `JSESSIONID`) |

## Variablen lesen

```
POST /var/readWriteVars?languageCode=de
[{"name":"APPL.CtrlAppl.sParam.outdoorTemp.values.actValue","attr":"1"},
 {"name":"APPL.CtrlAppl.sParam.heatCircuit[0].param.name"}]
```

Antwort (Werte immer als String):

```json
[{"name":"APPL.CtrlAppl.sParam.outdoorTemp.values.actValue",
  "attributes":{"formatId":"fmtTemp","longText":"Exterior temp.","lowerLimit":"-100","unitId":"Temp","upperLimit":"100"},
  "value":"10.808357"},
 {"name":"APPL.CtrlAppl.sParam.heatCircuit[0].param.name","value":"Puffer FBH"}]
```

Mit `"attr":"1"` liefert der Regler Grenzwerte und Einheit mit. Die App nutzt sie für die Stepper-Bereiche.

## Variablen schreiben

```
POST /var/readWriteVars?action=set
[{"name":"APPL.CtrlAppl.sParam.heatCircuit[0].param.offsetRoomTemp","value":"0.5"}]
```

Die Pfeiltasten der HMI schreiben genau diese Korrektur, in Schritten von ±0,5 K.

## Wichtige Variablen (Präfix `APPL.CtrlAppl.sParam.`)

| Variable | Bedeutung |
|---|---|
| `outdoorTemp.values.actValue` | Außentemperatur |
| `param.operatingMode` | Anlagen-Betriebsart: -1 Inbetriebnahme, 0 Standby, 1 Sommer (nur WW), 2 Heizen, 3 Kühlen, 4 Auto |
| `options.systemNumberOfHeatingCircuits` | Anzahl Heizkreise |
| `options.systemNumberOfHotWaterTanks` | Anzahl Warmwasserspeicher |
| `heatCircuit[i].param.name` | Name, z. B. „Puffer FBH“, „Heizkörper“ |
| `heatCircuit[i].values.setValue` | aktueller Raum-Sollwert (große Zahl auf der HMI) |
| `heatCircuit[i].param.offsetRoomTemp` | Korrektur (Pfeiltasten) |
| `heatCircuit[i].param.normalSetTemp` | Komfort-Temperatur |
| `heatCircuit[i].param.reducedSetTemp` | Absenk-Temperatur |
| `heatCircuit[i].param.operatingMode` | 0 Aus, 1 Auto, 2 Tag, 3 Nacht, 4 Urlaub, 5 Party, 8 Extern, 9 Raumregelung |
| `heatCircuit[i].values.heatRequest` | Heizanforderung aktiv |
| `heatCircuit[i].tempRoom.values.actValue` | Raumtemperatur (nur mit Raumfühler, siehe `options.heatCircuit[i].hasRoomTemp`) |
| `heatCircuit[i].param.holiday.start` / `.stop` | Urlaubszeitraum (Sekunden seit 1970) |
| `hotWaterTank[i].topTemp.values.actValue` | Warmwassertemperatur (47,1° auf der HMI) |
| `hotWaterTank[i].param.normalSetTempMax.value` | Warmwasser-Soll |
| `hotWaterTank[i].param.operatingMode` | 0 Aus, 1 Auto, 2 Ein, 3 Einmal aufheizen |
| `heatpump[i].values.heatpumpState` | 0 Standby, 1 Vorlauf, 2 Heizen, 3 Abtauen, 4 Kühlen, … 8 Fehler |

## Weitere Endpunkte aus dem Mitschnitt

| Endpunkt | Zweck |
|---|---|
| `alarm?action=getCount&languageCode=de` | Anzahl aktiver Alarme |
| `dateTime?action=getDateTime` | Uhrzeit des Reglers |
| `readMaskTree?action=getcontent` `{"filename":"DetailMask.xml"}` | Menübaum der HMI (alle Variablen) |
| `readMaskTree?action=getSettingsMenuContent` | Einstellungsmenü |
| `var/readAllUnits?action=getUnits`, `var/readAllFormats?action=getFormats` | Einheiten und Formate |
| `userLevel?action=getUserLevels` | Benutzerebenen (Endkunde = 1) |
| `eventlogger?action=log` | nur Logging der HMI, für die App nicht nötig |
