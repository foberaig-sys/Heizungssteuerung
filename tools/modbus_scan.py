#!/usr/bin/env python3
"""Liest die Modbus-TCP-Register des Wärmepumpen-Reglers aus (nur LESEN, es wird nichts verändert).

Der Regler (KEBA AP440) hat einen Modbus-TCP-Server auf Port 502, ohne Passwort. Welche Registernummer
welchen Wert enthält, ist nicht vollständig dokumentiert. Dieses Programm hilft, die Belegung zu finden:
Es liest einen Bereich aus und markiert Register, deren Wert zu Zahlen passt, die du am Display siehst.

Beispiele (im Heimnetz, am PC):
    python tools/modbus_scan.py --host 192.168.0.100
    python tools/modbus_scan.py --host 192.168.0.100 --find 22.0 19.5 47.8 9.2
    python tools/modbus_scan.py --host 192.168.0.100 --start 0 --end 2000 --csv register.csv
    python tools/modbus_scan.py --host 192.168.0.100 --compare register.csv
        → zeigt nur Register, die sich seit register.csv geändert haben (z. B. nachdem du am
          Display einen Sollwert verstellt hast). So findet man die Belegung eindeutig.

Bekannt (aus der evcc-Vorlage für M-TEC): 401 Warmwasser oben (x0,1 °C), 601 Puffer (x0,1 °C),
707 Leistungsaufnahme (W).

Nur Python-Standardbibliothek, keine Installation nötig.
"""
from __future__ import annotations

import argparse
import csv
import socket
import struct
import sys

READ_HOLDING = 3
READ_INPUT = 4
MAX_COUNT = 100  # Modbus erlaubt bis 125 Register pro Anfrage


class ModbusError(Exception):
    pass


class ModbusClient:
    def __init__(self, host: str, port: int = 502, unit: int = 1, timeout: float = 5):
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self.unit = unit
        self.transaction = 0

    def close(self) -> None:
        self.sock.close()

    def _recv(self, n: int) -> bytes:
        data = b""
        while len(data) < n:
            chunk = self.sock.recv(n - len(data))
            if not chunk:
                raise ModbusError("Verbindung vom Regler geschlossen")
            data += chunk
        return data

    def read(self, function: int, address: int, count: int) -> list[int]:
        """Liest `count` 16-Bit-Register ab `address`. Wirft ModbusError bei Ausnahmeantwort."""
        self.transaction = (self.transaction + 1) & 0xFFFF
        pdu = struct.pack(">BHH", function, address, count)
        self.sock.sendall(struct.pack(">HHHB", self.transaction, 0, len(pdu) + 1, self.unit) + pdu)
        _tid, _proto, length, _unit = struct.unpack(">HHHB", self._recv(7))
        body = self._recv(length - 1)
        if body[0] & 0x80:
            raise ModbusError(f"Ausnahme {body[1]} bei Adresse {address}")
        byte_count = body[1]
        return list(struct.unpack(f">{byte_count // 2}H", body[2:2 + byte_count]))


def scan(client: ModbusClient, function: int, start: int, end: int) -> dict[int, int]:
    """Liest den Bereich blockweise; nicht vorhandene Bereiche werden in kleineren Stücken übersprungen."""
    values: dict[int, int] = {}

    def read_block(address: int, count: int) -> None:
        try:
            for i, v in enumerate(client.read(function, address, count)):
                values[address + i] = v
        except ModbusError:
            if count > 1:
                half = count // 2
                read_block(address, half)
                read_block(address + half, count - half)

    address = start
    while address < end:
        count = min(MAX_COUNT, end - address)
        read_block(address, count)
        address += count
    return values


def signed(v: int) -> int:
    return v - 0x10000 if v >= 0x8000 else v


def matches(raw: int, targets: list[float]) -> list[str]:
    """Welche gesuchten Zahlen passen zu diesem Register (direkt, x0,1 oder x0,01)?"""
    s = signed(raw)
    hits = []
    for t in targets:
        for scale, label in ((1, "x1"), (0.1, "x0,1"), (0.01, "x0,01")):
            if abs(s * scale - t) <= max(0.05, abs(t) * 0.01):
                hits.append(f"{t} ({label})")
                break
    return hits


def load_csv(path: str) -> dict[int, int]:
    """Liest eine frühere --csv-Ausgabe. Nicht enthaltene Register hatten den Wert 0."""
    with open(path, newline="", encoding="utf-8") as f:
        return {int(row["adresse"]): int(row["roh"]) for row in csv.DictReader(f, delimiter=";")}


def changes(old: dict[int, int], new: dict[int, int]) -> list[tuple[int, int, int]]:
    """(Adresse, alt, neu) für alle Register, deren Wert sich geändert hat."""
    return [(a, old.get(a, 0), new[a]) for a in sorted(new) if old.get(a, 0) != new[a]]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Modbus-Register des Wärmepumpen-Reglers auslesen (nur lesen)")
    parser.add_argument("--host", required=True, help="IP-Adresse des Reglers, z. B. 192.168.0.100")
    parser.add_argument("--port", type=int, default=502)
    parser.add_argument("--unit", type=int, default=1, help="Modbus-Geräte-ID (Standard 1)")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=1200)
    parser.add_argument("--input", action="store_true", help="Input-Register statt Holding-Register lesen")
    parser.add_argument("--find", type=float, nargs="*", default=[],
                        help="Werte vom Display, z. B. 22.0 19.5 47.8 (Außentemperatur, Sollwerte …)")
    parser.add_argument("--all", action="store_true", help="auch Register mit Wert 0 anzeigen")
    parser.add_argument("--csv", help="Ergebnis zusätzlich als CSV-Datei speichern")
    parser.add_argument("--compare", metavar="CSV", help="nur Änderungen gegenüber einer früheren --csv-Datei zeigen")
    args = parser.parse_args(argv)

    try:
        client = ModbusClient(args.host, args.port, args.unit)
    except OSError as err:
        print(f"Keine Verbindung zu {args.host}:{args.port}: {err}", file=sys.stderr)
        return 1
    try:
        values = scan(client, READ_INPUT if args.input else READ_HOLDING, args.start, args.end)
    except (OSError, ModbusError) as err:
        print(f"Fehler beim Lesen: {err}", file=sys.stderr)
        return 1
    finally:
        client.close()

    if args.compare:
        try:
            old = load_csv(args.compare)
        except (OSError, KeyError, ValueError) as err:
            print(f"Kann {args.compare} nicht lesen: {err}", file=sys.stderr)
            return 1
        diff = changes(old, values)
        print(f"{len(diff)} Register haben sich seit {args.compare} geändert:\n")
        print(f"{'Adresse':>7}  {'alt':>7}  {'neu':>7}  {'alt x0,1':>9}  {'neu x0,1':>9}")
        for address, before, after in diff:
            print(f"{address:>7}  {signed(before):>7}  {signed(after):>7}  {signed(before) / 10:>9.1f}  {signed(after) / 10:>9.1f}")
        return 0

    rows = []
    for address in sorted(values):
        raw = values[address]
        if raw == 0 and not args.all:
            continue
        hits = matches(raw, args.find)
        rows.append((address, raw, signed(raw), signed(raw) / 10, ", ".join(hits)))

    print(f"{len(values)} Register gelesen, {len(rows)} angezeigt.\n")
    print(f"{'Adresse':>7}  {'roh':>6}  {'int16':>6}  {'x0,1':>7}  Treffer")
    for address, raw, s, tenth, hits in rows:
        marker = "  <==" if hits else ""
        print(f"{address:>7}  {raw:>6}  {s:>6}  {tenth:>7.1f}  {hits}{marker}")

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, delimiter=";")
            writer.writerow(["adresse", "roh", "int16", "x0,1", "treffer"])
            writer.writerows(rows)
        print(f"\nGespeichert in {args.csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
