#!/usr/bin/env python3
"""Ändert EINEN Sollwert der Wärmepumpe per Modbus TCP – vorsichtig und nur für bestätigte Register.

Erlaubt sind nur Werte, deren Registernummer durch Verstellen am Display eindeutig bestätigt wurde
(siehe docs/API.md). Vor dem Schreiben wird der aktuelle Wert gezeigt und nachgefragt, danach wird
zur Kontrolle zurückgelesen.

Beispiele (im Heimnetz, am PC):
    python tools/modbus_write.py --host 192.168.0.100 --list
    python tools/modbus_write.py --host 192.168.0.100 warmwasser 49
    python tools/modbus_write.py --host 192.168.0.100 fbh-komfort 22.5

Nur Python-Standardbibliothek, keine Installation nötig.
"""
from __future__ import annotations

import argparse
import struct
import sys
from dataclasses import dataclass

from modbus_scan import READ_HOLDING, ModbusClient, ModbusError, signed

WRITE_SINGLE = 6


@dataclass(frozen=True)
class Setting:
    address: int
    label: str
    minimum: float
    maximum: float
    scale: float = 0.1  # Register enthält Wert ×10


# Durch Änderungsvergleich am Display bestätigt (Heizkreis 2 hat denselben Aufbau, Block +50).
SETTINGS = {
    "fbh-komfort": Setting(4, "Puffer FBH – Komforttemperatur (°C)", 10, 30),
    "fbh-absenk": Setting(5, "Puffer FBH – Absenktemperatur (°C)", 10, 30),
    "hk-komfort": Setting(54, "Heizkörper – Komforttemperatur (°C)", 10, 30),
    "hk-absenk": Setting(55, "Heizkörper – Absenktemperatur (°C)", 10, 30),
    "warmwasser": Setting(402, "Warmwasser – Solltemperatur (°C)", 30, 60),
}


def write_register(client: ModbusClient, address: int, value: int) -> None:
    """Funktion 6 (Write Single Register). Der Regler wiederholt die Anfrage als Bestätigung."""
    client.transaction = (client.transaction + 1) & 0xFFFF
    pdu = struct.pack(">BHH", WRITE_SINGLE, address, value & 0xFFFF)
    client.sock.sendall(struct.pack(">HHHB", client.transaction, 0, len(pdu) + 1, client.unit) + pdu)
    _tid, _proto, length, _unit = struct.unpack(">HHHB", client._recv(7))
    body = client._recv(length - 1)
    if body[0] & 0x80:
        raise ModbusError(f"Regler lehnt das Schreiben ab (Ausnahme {body[1]}) – evtl. ist Modbus nur lesend freigegeben")


def read_value(client: ModbusClient, setting: Setting) -> float:
    return signed(client.read(READ_HOLDING, setting.address, 1)[0]) * setting.scale


def main(argv: list[str] | None = None, ask=input) -> int:
    parser = argparse.ArgumentParser(description="Einen Sollwert der Wärmepumpe per Modbus ändern")
    parser.add_argument("--host", required=True, help="IP-Adresse des Reglers, z. B. 192.168.0.100")
    parser.add_argument("--port", type=int, default=502)
    parser.add_argument("--unit", type=int, default=1)
    parser.add_argument("--list", action="store_true", help="alle Werte anzeigen, die geändert werden dürfen")
    parser.add_argument("--yes", action="store_true", help="ohne Rückfrage schreiben")
    parser.add_argument("setting", nargs="?", choices=sorted(SETTINGS), help="welcher Wert")
    parser.add_argument("value", nargs="?", type=float, help="neuer Wert, z. B. 49 oder 22.5")
    args = parser.parse_args(argv)

    if not args.list and (args.setting is None or args.value is None):
        parser.error("Bitte Wert und neue Zahl angeben, z. B.: warmwasser 49  (oder --list)")

    try:
        client = ModbusClient(args.host, args.port, args.unit)
    except OSError as err:
        print(f"Keine Verbindung zu {args.host}:{args.port}: {err}", file=sys.stderr)
        return 1

    try:
        if args.list:
            for key, setting in SETTINGS.items():
                print(f"{key:<12} {setting.label:<40} aktuell {read_value(client, setting):5.1f}"
                      f"   (erlaubt {setting.minimum:g}–{setting.maximum:g})")
            return 0

        setting = SETTINGS[args.setting]
        if not setting.minimum <= args.value <= setting.maximum:
            print(f"{args.value:g} liegt außerhalb von {setting.minimum:g}–{setting.maximum:g}.", file=sys.stderr)
            return 1
        raw = round(args.value / setting.scale)
        current = read_value(client, setting)
        print(f"{setting.label}: aktuell {current:.1f}, neu {raw * setting.scale:.1f}")
        if not args.yes and ask("Jetzt schreiben? (j/N) ").strip().lower() not in ("j", "ja", "y", "yes"):
            print("Abgebrochen, nichts geändert.")
            return 0

        write_register(client, setting.address, raw)
        after = read_value(client, setting)
        if abs(after - raw * setting.scale) < 0.01:
            print(f"OK – Regler meldet jetzt {after:.1f}. Bitte am Display kontrollieren.")
            return 0
        print(f"Geschrieben, aber der Regler meldet {after:.1f} statt {raw * setting.scale:.1f}.", file=sys.stderr)
        return 1
    except (OSError, ModbusError) as err:
        print(f"Fehler: {err}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
