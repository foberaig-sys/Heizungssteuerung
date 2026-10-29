// Betriebsarten mit denselben Symbolen wie am Display der Wärmepumpe.
import type { ModeTile } from '../ui/components';
import { icons } from '../ui/Icon';

export const systemModeTiles: ModeTile[] = [
  { value: 0, label: 'Standby', icon: icons.power },
  { value: 1, label: 'Warmwasser', icon: icons.drop },
  { value: 2, label: 'Automatik heizen', icon: icons.heat },
];

export const heatCircuitModeTiles: ModeTile[] = [
  { value: 0, label: 'Aus', icon: icons.power },
  { value: 1, label: 'Automatik', icon: icons.clock },
  { value: 2, label: 'Komfort', icon: icons.sun },
  { value: 3, label: 'Absenkung', icon: icons.moon },
];

export const hotWaterModeTiles: ModeTile[] = [
  { value: 0, label: 'Aus', icon: icons.power },
  { value: 1, label: 'Automatik', icon: icons.clock },
  { value: 2, label: 'Ein', icon: icons.drop },
  { value: 3, label: 'Aufheizen', icon: icons.flame },
];

export function tileLabel(tiles: ModeTile[], value: number | undefined): string {
  if (value === undefined) return '–';
  return tiles.find((t) => t.value === value)?.label ?? `Modus ${value}`;
}

export function tileIcon(tiles: ModeTile[], value: number | undefined) {
  return tiles.find((t) => t.value === value)?.icon;
}
