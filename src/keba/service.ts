// Fasst die einzelnen Reglervariablen zu einem Zustand zusammen und kapselt die Schreibbefehle.
import { KebaClient, KebaVariable, Range, formatNumber, toBool, toInt, toNumber, toRange } from './client';
import { KebaVar, allHeatCircuitVars, allHeatPumpVars, allHotWaterVars } from './variables';

export interface Setpoint {
  value: number;
  range?: Range;
}

export interface HeatCircuitStatus {
  index: number;
  name: string;
  roomTemperature?: number;
  roomHumidity?: number;
  currentSetTemperature?: number;
  flowSetTemperature?: number;
  offset?: Setpoint;
  normalSetTemperature?: Setpoint;
  reducedSetTemperature?: Setpoint;
  operatingMode?: number;
  heatRequest?: boolean;
}

export interface HotWaterStatus {
  index: number;
  name: string;
  temperature?: number;
  setTemperature?: Setpoint;
  operatingMode?: number;
  heatRequest?: boolean;
}

/** Messwerte der (ersten) Wärmepumpe und des Pufferspeichers – nur Anzeige. */
export interface HeatPumpStatus {
  flowTemperature?: number;
  returnTemperature?: number;
  sourceInTemperature?: number;
  sourceOutTemperature?: number;
  bufferTopTemperature?: number;
  bufferMidTemperature?: number;
  /** Aktuelle Leistungsaufnahme in W. */
  power?: number;
  /** Lüfter, Umwälzpumpe und Kompressor in %. */
  fan?: number;
  pump?: number;
  compressor?: number;
}

export interface HeatingSnapshot {
  outdoorTemperature?: number;
  heatPump?: HeatPumpStatus;
  systemOperatingMode?: number;
  heatCircuits: HeatCircuitStatus[];
  hotWaterTanks: HotWaterStatus[];
  fetchedAt: Date;
}

/** Nur das, was der Service vom Client braucht – erleichtert Tests. */
export type KebaTransport = Pick<KebaClient, 'read' | 'write'>;

export async function loadSnapshot(client: KebaTransport, now = new Date()): Promise<HeatingSnapshot> {
  const counts = await client.read([KebaVar.numberOfHeatingCircuits, KebaVar.numberOfHotWaterTanks]);
  const circuitCount = clamp(toInt(counts[KebaVar.numberOfHeatingCircuits]) ?? 1, 8);
  const tankCount = clamp(toInt(counts[KebaVar.numberOfHotWaterTanks]) ?? 1, 4);

  const names = [KebaVar.outdoorTemperature, KebaVar.systemOperatingMode];
  for (let i = 0; i < circuitCount; i++) names.push(...allHeatCircuitVars(i));
  for (let i = 0; i < tankCount; i++) names.push(...allHotWaterVars(i));
  names.push(...allHeatPumpVars(0));

  const v = await client.read(names, true);
  // Betriebswerte gibt es nur über Modbus; scheitert das Lesen, fehlt eben die Laufanzeige.
  const RUN = KebaVar.heatPumpRun;
  const run = await client.read(Object.values(RUN).map((f) => f(0))).catch(() => ({}) as typeof v);
  const HC = KebaVar.heatCircuit;
  const HW = KebaVar.hotWaterTank;

  const heatCircuits: HeatCircuitStatus[] = range(circuitCount).map((i) => {
    const hasRoomTemp = toBool(v[HC.hasRoomTemperature(i)]) ?? true;
    const hasHumidity = toBool(v[HC.hasRoomHumidity(i)]) ?? true;
    return {
      index: i,
      name: nonEmpty(v[HC.name(i)]?.value) ?? `Heizkreis ${i + 1}`,
      roomTemperature: hasRoomTemp ? toNumber(v[HC.roomTemperature(i)]) : undefined,
      roomHumidity: hasHumidity ? toNumber(v[HC.roomHumidity(i)]) : undefined,
      currentSetTemperature: toNumber(v[HC.setValue(i)]),
      flowSetTemperature: toNumber(v[HC.flowSetTemperature(i)]),
      offset: setpoint(v[HC.offset(i)]),
      normalSetTemperature: setpoint(v[HC.normalSetTemperature(i)]),
      reducedSetTemperature: setpoint(v[HC.reducedSetTemperature(i)]),
      operatingMode: toInt(v[HC.operatingMode(i)]),
      heatRequest: toBool(v[HC.heatRequest(i)]),
    };
  });

  const hotWaterTanks: HotWaterStatus[] = range(tankCount).map((i) => ({
    index: i,
    name: nonEmpty(v[HW.name(i)]?.value) ?? (tankCount === 1 ? 'Warmwasser' : `Warmwasser ${i + 1}`),
    temperature: toNumber(v[HW.temperature(i)]),
    setTemperature: setpoint(v[HW.setTemperature(i)]),
    operatingMode: toInt(v[HW.operatingMode(i)]),
    heatRequest: toBool(v[HW.heatRequest(i)]),
  }));

  const HP = KebaVar.heatPump;
  const BT = KebaVar.bufferTank;
  const heatPump: HeatPumpStatus = {
    flowTemperature: toNumber(v[HP.flowTemperature(0)]),
    returnTemperature: toNumber(v[HP.returnTemperature(0)]),
    sourceInTemperature: toNumber(v[HP.sourceInTemperature(0)]),
    sourceOutTemperature: toNumber(v[HP.sourceOutTemperature(0)]),
    bufferTopTemperature: toNumber(v[BT.topTemperature(0)]),
    bufferMidTemperature: toNumber(v[BT.midTemperature(0)]),
    power: toNumber(run[RUN.power(0)]),
    fan: percent(run[RUN.fan(0)]),
    pump: percent(run[RUN.pump(0)]),
    compressor: percent(run[RUN.compressor(0)]),
  };

  return {
    outdoorTemperature: toNumber(v[KebaVar.outdoorTemperature]),
    heatPump: Object.values(heatPump).some((x) => x !== undefined) ? heatPump : undefined,
    systemOperatingMode: toInt(v[KebaVar.systemOperatingMode]),
    heatCircuits,
    hotWaterTanks,
    fetchedAt: now,
  };
}

/** Anteil 0…1 → Prozent, auf eine Nachkommastelle. */
function percent(v: KebaVariable | undefined): number | undefined {
  const n = toNumber(v);
  return n === undefined ? undefined : Math.round(n * 1000) / 10;
}

// MARK: Läuft die Wärmepumpe?

/** Im Stillstand zieht die Wärmepumpe nur ein paar Watt (Scans: 3 W), im Betrieb mehrere hundert. */
const RUNNING_POWER_W = 100;

/**
 * true = Kompressor läuft, false = steht, undefined = unbekannt (keine Betriebswerte).
 * Der Lüfter einer Luft-Wärmepumpe dreht nur im Betrieb – das zählt auch, falls die Leistung fehlt;
 * über den Fernzugriff verrät es zusätzlich die Kompressor-Ansteuerung.
 */
export function isHeatPumpRunning(hp: HeatPumpStatus | undefined): boolean | undefined {
  if (hp?.power === undefined && hp?.fan === undefined && hp?.compressor === undefined) return undefined;
  return (hp.power ?? 0) >= RUNNING_POWER_W || (hp.fan ?? 0) > 0 || (hp.compressor ?? 0) > 0;
}

// MARK: Welcher Sollwert gilt gerade?

export type ActiveSetpoint = 'offset' | 'normal' | 'reduced';

/**
 * Welchen Wert die Pfeiltasten verstellen sollen: den, der gerade gilt. Mit Korrektur (Web-HMI) wie an der
 * HMI die Korrektur; sonst je nach Betriebsart Komfort bzw. Absenkung. In Automatik verrät der aktuelle
 * Sollwert, welche Phase des Zeitprogramms gerade läuft. Bei „Aus“ gibt es nichts zu verstellen.
 */
export function activeSetpoint(c: HeatCircuitStatus): ActiveSetpoint | undefined {
  if (c.offset) return 'offset';
  if (c.operatingMode === 0) return undefined;
  if (c.operatingMode === 3) return c.reducedSetTemperature ? 'reduced' : undefined;
  if (c.operatingMode === 2) return c.normalSetTemperature ? 'normal' : undefined;
  const current = c.currentSetTemperature;
  const near = (v: number | undefined) => current !== undefined && v !== undefined && Math.abs(current - v) < 0.05;
  if (near(c.reducedSetTemperature?.value) && !near(c.normalSetTemperature?.value)) return 'reduced';
  if (c.normalSetTemperature) return 'normal';
  return c.reducedSetTemperature ? 'reduced' : undefined;
}

// MARK: Schreiben

const writeNumber = (client: KebaTransport, name: string, value: number) =>
  client.write([{ name, value: formatNumber(value) }]);

export const commands = {
  setSystemMode: (c: KebaTransport, mode: number) => writeNumber(c, KebaVar.systemOperatingMode, mode),
  /** Entspricht den Pfeiltasten auf dem HMI-Startbildschirm. */
  setOffset: (c: KebaTransport, circuit: number, value: number) => writeNumber(c, KebaVar.heatCircuit.offset(circuit), value),
  setNormalTemperature: (c: KebaTransport, circuit: number, value: number) =>
    writeNumber(c, KebaVar.heatCircuit.normalSetTemperature(circuit), value),
  setReducedTemperature: (c: KebaTransport, circuit: number, value: number) =>
    writeNumber(c, KebaVar.heatCircuit.reducedSetTemperature(circuit), value),
  setHeatCircuitMode: (c: KebaTransport, circuit: number, mode: number) =>
    writeNumber(c, KebaVar.heatCircuit.operatingMode(circuit), mode),
  setHotWaterTemperature: (c: KebaTransport, tank: number, value: number) =>
    writeNumber(c, KebaVar.hotWaterTank.setTemperature(tank), value),
  setHotWaterMode: (c: KebaTransport, tank: number, mode: number) =>
    writeNumber(c, KebaVar.hotWaterTank.operatingMode(tank), mode),
};

// MARK: Hilfen

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function nonEmpty(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

function setpoint(v: KebaVariable | undefined): Setpoint | undefined {
  const value = toNumber(v);
  return value === undefined ? undefined : { value, range: toRange(v?.attributes) };
}
