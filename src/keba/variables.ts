// Variablennamen des KEBA-Reglers (M-TEC Wärmepumpe), so wie die WebHMI sie anfragt.
// Indizes sind 0-basiert: heatCircuit[0] ist der erste Heizkreis.

const P = 'APPL.CtrlAppl.sParam';

export const KebaVar = {
  outdoorTemperature: `${P}.outdoorTemp.values.actValue`,
  systemOperatingMode: `${P}.param.operatingMode`,
  numberOfHeatingCircuits: `${P}.options.systemNumberOfHeatingCircuits`,
  numberOfHotWaterTanks: `${P}.options.systemNumberOfHotWaterTanks`,

  heatCircuit: {
    name: (i: number) => `${P}.heatCircuit[${i}].param.name`,
    hasRoomTemperature: (i: number) => `${P}.options.heatCircuit[${i}].hasRoomTemp`,
    hasRoomHumidity: (i: number) => `${P}.options.heatCircuit[${i}].hasRoomHumidity`,
    roomTemperature: (i: number) => `${P}.heatCircuit[${i}].tempRoom.values.actValue`,
    roomHumidity: (i: number) => `${P}.heatCircuit[${i}].humidityRoom.values.actValue`,
    /** Aktueller Sollwert inkl. Korrektur (große Zahl auf dem HMI-Startbildschirm). */
    setValue: (i: number) => `${P}.heatCircuit[${i}].values.setValue`,
    flowSetTemperature: (i: number) => `${P}.heatCircuit[${i}].values.flowSetTemp`,
    /** Korrektur, die die Pfeiltasten der HMI in 0,5-K-Schritten verändern. */
    offset: (i: number) => `${P}.heatCircuit[${i}].param.offsetRoomTemp`,
    normalSetTemperature: (i: number) => `${P}.heatCircuit[${i}].param.normalSetTemp`,
    reducedSetTemperature: (i: number) => `${P}.heatCircuit[${i}].param.reducedSetTemp`,
    operatingMode: (i: number) => `${P}.heatCircuit[${i}].param.operatingMode`,
    heatRequest: (i: number) => `${P}.heatCircuit[${i}].values.heatRequest`,
  },

  heatPump: {
    flowTemperature: (i: number) => `${P}.heatpump[${i}].TempHeatFlow.values.actValue`,
    returnTemperature: (i: number) => `${P}.heatpump[${i}].TempHeatReflux.values.actValue`,
    sourceInTemperature: (i: number) => `${P}.heatpump[${i}].TempSourceIn.values.actValue`,
    sourceOutTemperature: (i: number) => `${P}.heatpump[${i}].TempSourceOut.values.actValue`,
  },

  bufferTank: {
    topTemperature: (i: number) => `${P}.bufferTank[${i}].topTemp.values.actValue`,
    midTemperature: (i: number) => `${P}.bufferTank[${i}].midTemp.values.actValue`,
  },

  hotWaterTank: {
    name: (i: number) => `${P}.hotWaterTank[${i}].param.name`,
    temperature: (i: number) => `${P}.hotWaterTank[${i}].topTemp.values.actValue`,
    setTemperature: (i: number) => `${P}.hotWaterTank[${i}].param.normalSetTempMax.value`,
    operatingMode: (i: number) => `${P}.hotWaterTank[${i}].param.operatingMode`,
    heatRequest: (i: number) => `${P}.hotWaterTank[${i}].values.heatRequestTop`,
  },
};

export const allHeatCircuitVars = (i: number) => Object.values(KebaVar.heatCircuit).map((f) => f(i));
export const allHotWaterVars = (i: number) => Object.values(KebaVar.hotWaterTank).map((f) => f(i));
export const allHeatPumpVars = (i: number) => [
  ...Object.values(KebaVar.heatPump).map((f) => f(i)),
  ...Object.values(KebaVar.bufferTank).map((f) => f(i)),
];

export interface ModeOption {
  value: number;
  label: string;
}

// Betriebsarten laut keba_keenergy_api (superbox-dev), passend zu den Icons der HMI.
export const SystemModes: ModeOption[] = [
  { value: -1, label: 'Inbetriebnahme' },
  { value: 0, label: 'Standby' },
  { value: 1, label: 'Nur Warmwasser' },
  { value: 2, label: 'Automatik heizen' },
  { value: 3, label: 'Kühlen' },
  { value: 4, label: 'Automatik Heizen/Kühlen' },
];
/** Was die HMI im Menü "Betriebsart" zur Auswahl anbietet. */
export const selectableSystemModes = [0, 1, 2];

export const HeatCircuitModes: ModeOption[] = [
  { value: 0, label: 'Aus' },
  { value: 1, label: 'Automatik (Zeitprogramm)' },
  { value: 2, label: 'Dauernd Komfort' },
  { value: 3, label: 'Dauernd Absenkung' },
  { value: 4, label: 'Urlaub' },
  { value: 5, label: 'Party' },
  { value: 8, label: 'Extern' },
  { value: 9, label: 'Raumregelung' },
];
export const selectableHeatCircuitModes = [0, 1, 2, 3];

export const HotWaterModes: ModeOption[] = [
  { value: 0, label: 'Aus' },
  { value: 1, label: 'Automatik (Zeitprogramm)' },
  { value: 2, label: 'Dauernd Ein' },
  { value: 3, label: 'Aufheizen' },
];
export const selectableHotWaterModes = [0, 1, 2, 3];

export function modeLabel(modes: ModeOption[], value: number | undefined): string {
  if (value === undefined) return '–';
  return modes.find((m) => m.value === value)?.label ?? `Modus ${value}`;
}
