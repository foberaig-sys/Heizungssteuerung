import { useColorScheme } from 'react-native';

export const ORANGE = '#FF9E00';

const light = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  secondary: '#6E6E73',
  separator: '#D1D1D6',
  accent: ORANGE,
  accentText: '#FFFFFF',
  water: '#0A84FF',
  danger: '#FF3B30',
  pressed: '#E5E5EA',
};

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#F2F2F7',
  secondary: '#98989F',
  separator: '#38383A',
  accent: ORANGE,
  accentText: '#000000',
  water: '#64D2FF',
  danger: '#FF453A',
  pressed: '#2C2C2E',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** 22 → "22,0°" */
export function formatTemp(value: number | undefined, unit = '°'): string {
  if (value === undefined) return '–';
  return value.toFixed(1).replace('.', ',') + unit;
}

/** 0.5 → "+0,5 K" */
export function formatSigned(value: number, unit = ' K'): string {
  const text = Math.abs(value).toFixed(1).replace('.', ',');
  return (value > 0 ? '+' : value < 0 ? '−' : '±') + text + unit;
}
