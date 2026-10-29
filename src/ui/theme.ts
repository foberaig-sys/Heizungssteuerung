import { useColorScheme } from 'react-native';

export const ORANGE = '#FF9500';

// Farben nach den iOS-Systemfarben, damit sich die App wie ein Teil des iPhones anfühlt.
const light = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  secondary: 'rgba(60, 60, 67, 0.6)',
  tertiary: 'rgba(60, 60, 67, 0.3)',
  separator: 'rgba(60, 60, 67, 0.29)',
  fill: 'rgba(120, 120, 128, 0.12)',
  pressed: 'rgba(120, 120, 128, 0.2)',
  accent: ORANGE,
  accentText: '#FFFFFF',
  accentSoft: 'rgba(255, 149, 0, 0.14)',
  water: '#007AFF',
  danger: '#FF3B30',
  tabBar: 'rgba(255, 255, 255, 0.72)',
  tabBarBorder: 'rgba(255, 255, 255, 0.6)',
  blurTint: 'systemChromeMaterialLight' as 'systemChromeMaterialLight' | 'systemChromeMaterialDark',
};

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  secondary: 'rgba(235, 235, 245, 0.6)',
  tertiary: 'rgba(235, 235, 245, 0.3)',
  separator: 'rgba(84, 84, 88, 0.6)',
  fill: 'rgba(118, 118, 128, 0.24)',
  pressed: 'rgba(118, 118, 128, 0.36)',
  accent: '#FF9F0A',
  accentText: '#000000',
  accentSoft: 'rgba(255, 159, 10, 0.18)',
  water: '#0A84FF',
  danger: '#FF453A',
  tabBar: 'rgba(30, 30, 30, 0.72)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  blurTint: 'systemChromeMaterialDark' as const,
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

/** Typografie nach iOS: große Schrift mit enger, kleine mit leicht weiter Laufweite. */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: -0.4 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.26 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.43 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const, letterSpacing: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0 },
  /** Große Temperaturen: leicht, eng gesetzt, Ziffern gleich breit. */
  display: { fontSize: 64, lineHeight: 70, fontWeight: '300' as const, letterSpacing: -2, fontVariant: ['tabular-nums' as const] },
  displaySmall: { fontSize: 34, lineHeight: 40, fontWeight: '400' as const, letterSpacing: -0.8, fontVariant: ['tabular-nums' as const] },
};
