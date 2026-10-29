import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Ein Symbol – auf dem iPhone als echtes SF Symbol, sonst als passendes Ionicon. */
export interface IconSpec {
  sf: SFSymbol;
  fallback: IoniconName;
}

export const icons = {
  home: { sf: 'house.fill', fallback: 'home' },
  modes: { sf: 'slider.horizontal.3', fallback: 'options' },
  data: { sf: 'chart.bar.xaxis', fallback: 'stats-chart' },
  settings: { sf: 'gearshape.fill', fallback: 'settings' },
  power: { sf: 'power', fallback: 'power' },
  clock: { sf: 'clock', fallback: 'time-outline' },
  sun: { sf: 'sun.max.fill', fallback: 'sunny' },
  moon: { sf: 'moon.fill', fallback: 'moon' },
  drop: { sf: 'drop.fill', fallback: 'water' },
  flame: { sf: 'flame.fill', fallback: 'flame' },
  heat: { sf: 'heat.waves', fallback: 'flame-outline' },
  up: { sf: 'chevron.up', fallback: 'chevron-up' },
  minus: { sf: 'minus', fallback: 'remove' },
  plus: { sf: 'plus', fallback: 'add' },
  down: { sf: 'chevron.down', fallback: 'chevron-down' },
  forward: { sf: 'chevron.right', fallback: 'chevron-forward' },
  back: { sf: 'chevron.left', fallback: 'chevron-back' },
  check: { sf: 'checkmark', fallback: 'checkmark' },
  thermometer: { sf: 'thermometer.medium', fallback: 'thermometer' },
  wind: { sf: 'wind', fallback: 'leaf-outline' },
  wifiOff: { sf: 'wifi.exclamationmark', fallback: 'cloud-offline' },
} satisfies Record<string, IconSpec>;

export function Icon({ icon, size = 22, color }: { icon: IconSpec; size?: number; color: string }) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={icon.sf}
        size={size}
        tintColor={color}
        weight="medium"
        resizeMode="scaleAspectFit"
        fallback={<Ionicons name={icon.fallback} size={size} color={color} />}
      />
    );
  }
  return <Ionicons name={icon.fallback} size={size} color={color} />;
}
