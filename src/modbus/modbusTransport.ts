// Übersetzt die Variablennamen der WebHMI auf Modbus-Register. Dadurch funktionieren loadSnapshot()
// und commands aus src/keba/service.ts unverändert – nur der Transport ist ein anderer.
//
// Belegung durch Verstellen am Display und Vergleich zweier Scans bestätigt (siehe docs/API.md):
// Heizkreis i liegt im Block ab 50·i, Warmwasser ab 400, Puffer ab 600, Wärmepumpe ab 700, System ab 1500.
import { KebaError, KebaVariable, KebaWrite } from '../keba/client';
import type { KebaTransport } from '../keba/service';
import { KebaVar } from '../keba/variables';
import { MAX_READ, ModbusError, ModbusTcpClient, toSigned16 } from './modbusClient';

interface RegisterMapping {
  address: number;
  /** Register enthält Wert ÷ scale, z. B. 0.1 → 225 bedeutet 22,5. */
  scale: number;
  /** Nur bestätigte Sollwerte dürfen geschrieben werden. */
  writable?: { min: number; max: number; allowed?: number[] };
}

export interface ModbusLayout {
  circuitNames: string[];
  hotWaterName?: string;
}

const temperature = (address: number, writable?: RegisterMapping['writable']): RegisterMapping => ({
  address,
  scale: 0.1,
  writable,
});
const raw = (address: number, writable?: RegisterMapping['writable']): RegisterMapping => ({ address, scale: 1, writable });

// Betriebsarten, die am Display umgestellt und per Scan bestätigt wurden.
const HEAT_CIRCUIT_MODES = { min: 0, max: 3, allowed: [0, 1, 2, 3] }; // Aus, Uhr, Sonne, Mond
const HOT_WATER_MODES = { min: 0, max: 3, allowed: [0, 1, 2, 3] }; // Aus, Automatik, Ein, Aufheizen
const SYSTEM_MODES = { min: 0, max: 2, allowed: [0, 1, 2] }; // Standby, Warmwasser, Automatik heizen

export function buildRegisterMap(circuitCount: number): Map<string, RegisterMapping> {
  const map = new Map<string, RegisterMapping>();
  const HC = KebaVar.heatCircuit;
  for (let i = 0; i < circuitCount; i++) {
    const base = 50 * i;
    map.set(HC.setValue(i), temperature(base + 2));
    map.set(HC.normalSetTemperature(i), temperature(base + 4, { min: 10, max: 30 }));
    map.set(HC.reducedSetTemperature(i), temperature(base + 5, { min: 10, max: 30 }));
    map.set(HC.operatingMode(i), raw(base + 7, HEAT_CIRCUIT_MODES));
    map.set(HC.heatRequest(i), raw(base + 8));
  }
  const HW = KebaVar.hotWaterTank;
  map.set(HW.temperature(0), temperature(401));
  map.set(HW.setTemperature(0), temperature(402, { min: 30, max: 60 }));
  map.set(HW.operatingMode(0), raw(403, HOT_WATER_MODES));
  map.set(KebaVar.systemOperatingMode, raw(1500, SYSTEM_MODES));

  // Messwerte (nur lesen). Register passen zu Display und Statusbericht.
  map.set(KebaVar.outdoorTemperature, temperature(1502));
  const HP = KebaVar.heatPump;
  map.set(HP.flowTemperature(0), temperature(705));
  map.set(HP.returnTemperature(0), temperature(710));
  map.set(HP.sourceInTemperature(0), temperature(708));
  map.set(HP.sourceOutTemperature(0), temperature(709));
  map.set(KebaVar.bufferTank.topTemperature(0), temperature(601));
  map.set(KebaVar.bufferTank.midTemperature(0), temperature(603));
  return map;
}

/** Fasst Adressen zu wenigen zusammenhängenden Leseblöcken zusammen. */
export function groupAddresses(addresses: number[], maxGap = 16, maxCount = MAX_READ): { start: number; count: number }[] {
  const sorted = [...new Set(addresses)].sort((a, b) => a - b);
  const blocks: { start: number; count: number }[] = [];
  for (const address of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && address - (last.start + last.count - 1) <= maxGap && address - last.start < maxCount) {
      last.count = address - last.start + 1;
    } else {
      blocks.push({ start: address, count: 1 });
    }
  }
  return blocks;
}

function formatValue(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export class ModbusTransport implements KebaTransport {
  private map: Map<string, RegisterMapping>;
  private statics: Map<string, string>;

  constructor(private client: ModbusTcpClient, layout: ModbusLayout) {
    const circuits = layout.circuitNames.length;
    this.map = buildRegisterMap(circuits);
    this.statics = new Map<string, string>([
      [KebaVar.numberOfHeatingCircuits, String(circuits)],
      [KebaVar.numberOfHotWaterTanks, '1'],
      [KebaVar.hotWaterTank.name(0), layout.hotWaterName ?? 'Warmwasser'],
      // Kein Raumfühler/Feuchtefühler über Modbus bekannt → nicht anzeigen.
      ...layout.circuitNames.flatMap((name, i): [string, string][] => [
        [KebaVar.heatCircuit.name(i), name],
        [KebaVar.heatCircuit.hasRoomTemperature(i), 'false'],
        [KebaVar.heatCircuit.hasRoomHumidity(i), 'false'],
      ]),
    ]);
  }

  async read(names: string[], withAttributes = false): Promise<Record<string, KebaVariable>> {
    const result: Record<string, KebaVariable> = {};
    for (const name of names) {
      const value = this.statics.get(name);
      if (value !== undefined) result[name] = { name, value };
    }

    const wanted = names.filter((n) => this.map.has(n));
    const registers = new Map<number, number>();
    try {
      for (const block of groupAddresses(wanted.map((n) => this.map.get(n)!.address))) {
        const values = await this.client.readHolding(block.start, block.count);
        values.forEach((v, i) => registers.set(block.start + i, v));
      }
    } catch (error) {
      throw toKebaError(error);
    }

    for (const name of wanted) {
      const mapping = this.map.get(name)!;
      const rawValue = registers.get(mapping.address);
      if (rawValue === undefined) continue;
      result[name] = {
        name,
        value: formatValue(toSigned16(rawValue) * mapping.scale),
        attributes:
          withAttributes && mapping.writable && mapping.scale !== 1
            ? { lowerLimit: String(mapping.writable.min), upperLimit: String(mapping.writable.max) }
            : undefined,
      };
    }
    return result;
  }

  async write(values: KebaWrite[]): Promise<void> {
    for (const { name, value } of values) {
      const mapping = this.map.get(name);
      if (!mapping?.writable) {
        throw new KebaError('server', 'Diese Einstellung ist über Modbus noch nicht freigeschaltet.');
      }
      const number = Number(value);
      const { min, max, allowed } = mapping.writable;
      if (!Number.isFinite(number) || number < min || number > max || (allowed && !allowed.includes(number))) {
        throw new KebaError('server', `Wert ${value} liegt außerhalb von ${mapping.writable.min}–${mapping.writable.max}.`);
      }
      try {
        await this.client.writeSingle(mapping.address, Math.round(number / mapping.scale));
      } catch (error) {
        throw toKebaError(error);
      }
    }
  }

  /** Ob ein Wert (z. B. die Betriebsart) über diese Verbindung geändert werden kann. */
  canWrite(name: string): boolean {
    return this.map.get(name)?.writable !== undefined;
  }
}

function toKebaError(error: unknown): KebaError {
  if (error instanceof KebaError) return error;
  if (error instanceof ModbusError && error.kind === 'exception') {
    return new KebaError('server', `Der Regler lehnt die Anfrage ab (Modbus-Ausnahme ${error.exceptionCode}).`);
  }
  return new KebaError('network', 'Wärmepumpe nicht erreichbar. Bist du im WLAN zuhause (oder per VPN verbunden)?');
}
