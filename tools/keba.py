#!/usr/bin/env python3
"""Kleines Kommandozeilen-Werkzeug, um die Regler-Schnittstelle vom PC aus zu testen.

Beispiele:
    python3 tools/keba.py --url http://192.168.1.50 status
    python3 tools/keba.py --url http://192.168.1.50 read APPL.CtrlAppl.sParam.outdoorTemp.values.actValue
    python3 tools/keba.py --url http://192.168.1.50 set APPL.CtrlAppl.sParam.heatCircuit[0].param.offsetRoomTemp 0.5

Im Heimnetz mit HTTPS und Passwort (neuere Firmware):
    python3 tools/keba.py --url https://192.168.0.100 --insecure --user BENUTZER --password PASSWORT status

Über den Fernzugriff (Port und Cookies aus dem Browser, F12 → Netzwerk):
    python3 tools/keba.py --url https://remote.keba.com:58841 --cookie 'GM_...=...; JSESSIONID=...' status

Nur Python-Standardbibliothek, keine Installation nötig.
"""
from __future__ import annotations

import argparse
import base64
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

PREFIX = "APPL.CtrlAppl.sParam"


class KebaError(Exception):
    pass


class Keba:
    def __init__(self, url: str, cookie: str | None = None, user: str | None = None,
                 password: str | None = None, timeout: float = 15, insecure: bool = False):
        self.url = url.rstrip("/")
        if "://" not in self.url:
            self.url = "http://" + self.url
        self.cookie = cookie
        self.auth = None
        if user:
            self.auth = base64.b64encode(f"{user}:{password or ''}".encode()).decode()
        self.timeout = timeout
        # Der Regler im Heimnetz hat ein selbst ausgestelltes Zertifikat (--insecure).
        self.ssl_context = ssl._create_unverified_context() if insecure else None

    def _post(self, path: str, query: dict[str, str], body: object | None) -> object:
        url = f"{self.url}/{path}?{urllib.parse.urlencode(query)}"
        data = json.dumps(body).encode() if body is not None else b""
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json; charset=UTF-8")
        req.add_header("Accept", "*/*")
        req.add_header("Origin", self.url)
        req.add_header("Referer", self.url + "/")
        if self.cookie:
            req.add_header("Cookie", self.cookie)
        if self.auth:
            req.add_header("Authorization", "Basic " + self.auth)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self.ssl_context) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as err:
            raise KebaError(f"HTTP {err.code}: {err.read()[:300]!r}") from err
        text = raw.decode("utf-8", "replace").strip()
        if text.startswith("<"):
            raise KebaError("HTML statt JSON erhalten - Sitzung abgelaufen oder falsche Adresse?")
        return json.loads(text) if text else None

    def read(self, names: list[str], attributes: bool = False) -> dict[str, dict]:
        payload = [{"name": n, **({"attr": "1"} if attributes else {})} for n in names]
        result = self._post("var/readWriteVars", {"languageCode": "de"}, payload)
        if isinstance(result, dict):
            result = [result]
        return {item["name"]: item for item in result or []}

    def set(self, values: dict[str, str]) -> object:
        payload = [{"name": k, "value": str(v)} for k, v in values.items()]
        return self._post("var/readWriteVars", {"action": "set"}, payload)


def status(keba: Keba) -> list[str]:
    counts = keba.read([f"{PREFIX}.options.systemNumberOfHeatingCircuits",
                        f"{PREFIX}.options.systemNumberOfHotWaterTanks"])
    hc = int(float(counts.get(f"{PREFIX}.options.systemNumberOfHeatingCircuits", {}).get("value", 1)))
    hw = int(float(counts.get(f"{PREFIX}.options.systemNumberOfHotWaterTanks", {}).get("value", 1)))

    names = [f"{PREFIX}.outdoorTemp.values.actValue", f"{PREFIX}.param.operatingMode"]
    for i in range(hc):
        names += [f"{PREFIX}.heatCircuit[{i}].{s}" for s in
                  ("param.name", "values.setValue", "param.offsetRoomTemp", "param.normalSetTemp",
                   "param.reducedSetTemp", "param.operatingMode", "values.heatRequest")]
    for i in range(hw):
        names += [f"{PREFIX}.hotWaterTank[{i}].{s}" for s in
                  ("topTemp.values.actValue", "param.normalSetTempMax.value", "param.operatingMode")]
    values = keba.read(names)
    return [f"{name.removeprefix(PREFIX + '.')} = {values.get(name, {}).get('value', '?')}" for name in names]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="KEBA/M-TEC WebHMI-Schnittstelle testen")
    parser.add_argument("--url", required=True, help="z. B. http://192.168.1.50 oder https://remote.keba.com:58841")
    parser.add_argument("--cookie", help="Cookie-Header für den Fernzugriff")
    parser.add_argument("--user")
    parser.add_argument("--password")
    parser.add_argument("--insecure", action="store_true",
                        help="selbst ausgestelltes Zertifikat des Reglers akzeptieren (https im Heimnetz)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="wichtigste Werte anzeigen")
    p_read = sub.add_parser("read", help="Variablen lesen")
    p_read.add_argument("names", nargs="+")
    p_read.add_argument("--attr", action="store_true", help="Grenzwerte/Einheiten mitliefern")
    p_set = sub.add_parser("set", help="Variable schreiben")
    p_set.add_argument("name")
    p_set.add_argument("value")
    args = parser.parse_args(argv)

    keba = Keba(args.url, args.cookie, args.user, args.password, insecure=args.insecure)
    try:
        if args.command == "status":
            print("\n".join(status(keba)))
        elif args.command == "read":
            print(json.dumps(list(keba.read(args.names, args.attr).values()), indent=2, ensure_ascii=False))
        elif args.command == "set":
            print(json.dumps(keba.set({args.name: args.value}), indent=2, ensure_ascii=False))
    except (KebaError, OSError) as err:
        print(f"Fehler: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
