# Schnittstelle des KEBA-Reglers (M-TEC WebHMI)

Ermittelt aus dem Netzwerk-Mitschnitt der WebHMI (`https://remote.keba.com:<Port>`). Abgeglichen mit der
Open-Source-Bibliothek [keba_keenergy_api](https://github.com/superbox-dev/keba_keenergy_api).

Alle Aufrufe sind `POST`-Requests mit `Content-Type: application/json; charset=UTF-8`.

## Basis-URL

| Weg | Basis-URL | Anmeldung |
|---|---|---|
| Heimnetz | `https://<IP-des-Reglers>` (selbstsigniertes Zertifikat), ältere Firmware `http://` | HTTP Basic Auth, wenn die Funktion `basic-auth` aktiv ist |
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

## Erkenntnisse aus dem Statusbericht (KeEnergy.MTec 2.9.1)

- Regler AP440, Hostname `AP440-1`, im Heimnetz per Kabel (eth0) und IP-Adresse per DHCP.
- In `/opt/kecontrolapplication/config/default/features/` sind `https` und `basic-auth` aktiv: Die WebHMI im
  Heimnetz ist nur per HTTPS mit Benutzername/Passwort erreichbar, ein Aufruf über `http://` antwortet nicht.
- Der Secomea-Agent „WebHmi“ leitet auf `127.0.0.1:80` (`cfg="LO tcp=80"`), also auf den Webserver des
  Reglers selbst. Deshalb klappt der Fernzugriff ohne Zertifikat und Passwort.
- Ein **Modbus-TCP-Server** läuft auf `0.0.0.0:502` (ohne Verschlüsselung, ohne Passwort). Diesen Weg nutzt
  z. B. Loxone. Die Registerbelegung steht auf dem Regler in
  `config/KeEnergy.MTec-*/ModbusServerRegisters.cfg` und ist nicht Teil des Statusberichts.
- `heatCircuit[i].values.heatRequest` ist `SINT16` (0 = keine Anforderung), nicht `BOOL`.

## Modbus TCP (Port 502, ohne Passwort)

Bekannte Holding-Register laut der M-TEC-Vorlage des Projekts [evcc](https://github.com/evcc-io/evcc)
(`templates/definition/charger/mtec.yaml`):

| Register | Bedeutung | Typ |
|---|---|---|
| 401 | Warmwasser oben | int16, ×0,1 °C |
| 601 | Puffer | int16, ×0,1 °C |
| 707 | aktuelle Leistungsaufnahme der Wärmepumpe | int16, W |
| 1000 | PV-Überschussleistung (schreibbar) | int16, W |

Die übrige Belegung lässt sich mit `tools/modbus_scan.py` (nur lesend) durch Vergleich mit den Display-Werten finden.
