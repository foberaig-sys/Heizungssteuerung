import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { HeatPumpStatus, isHeatPumpRunning } from '../keba/service';
import { Icon, icons } from '../ui/Icon';
import { type, useTheme } from '../ui/theme';

const TURN_MS = 1800;

/**
 * Läuft die Wärmepumpe? Im Betrieb dreht sich das Lüfterrad gleichmäßig; beim Abschalten läuft es aus,
 * statt hart stehen zu bleiben. Der Wechsel selbst federt sanft. Mit „Bewegung reduzieren“ steht das Rad still.
 */
export function HeatPumpStatusRow({ heatPump }: { heatPump: HeatPumpStatus | undefined }) {
  const theme = useTheme();
  const running = isHeatPumpRunning(heatPump);
  const reduceMotion = useReduceMotion();
  const spin = useSpin(running === true && !reduceMotion);
  const emphasis = useRef(new Animated.Value(running ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(emphasis, {
      toValue: running ? 1 : 0,
      useNativeDriver: true,
      damping: 14,
      stiffness: 180,
      mass: 1,
    }).start();
  }, [running, emphasis]);

  if (running === undefined) return null;

  const detail = running
    ? [heatPump?.power !== undefined && `${Math.round(heatPump.power)} W`, heatPump?.fan !== undefined && `Lüfter ${Math.round(heatPump.fan)} %`]
        .filter(Boolean)
        .join('  ·  ')
    : 'Kompressor aus';
  const title = running ? 'Wärmepumpe läuft' : 'Wärmepumpe steht';

  // Läuft sie, wird der Kreis kurz größer und farbig – ein kleines, körperliches „Anspringen“.
  const scale = emphasis.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={`${title}, ${detail}`}>
      <Animated.View
        style={[styles.badge, { backgroundColor: running ? theme.accentSoft : theme.fill, transform: [{ scale }] }]}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon icon={icons.fan} size={22} color={running ? theme.accent : theme.secondary} />
        </Animated.View>
      </Animated.View>
      <View style={styles.text}>
        <Text style={[type.headline, { color: theme.text }]}>{title}</Text>
        <Text style={[type.footnote, styles.tabular, { color: theme.secondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

/** 0 → 1 je Umdrehung. Beim Stoppen dreht das Rad die angefangene Runde abgebremst zu Ende. */
function useSpin(active: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      value.stopAnimation((at) => {
        // Sanft anlaufen bis zum Ende der aktuellen Runde, dann gleichmäßig weiter.
        Animated.timing(value, {
          toValue: 1,
          duration: TURN_MS * 1.6 * (1 - at),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          value.setValue(0);
          Animated.loop(
            Animated.timing(value, { toValue: 1, duration: TURN_MS, easing: Easing.linear, useNativeDriver: true }),
          ).start();
        });
      });
      return;
    }
    value.stopAnimation((at) => {
      if (at === 0) return;
      Animated.timing(value, {
        toValue: 1,
        duration: TURN_MS * 2 * (1 - at) + 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && value.setValue(0));
    });
  }, [active, value]);
  useEffect(() => () => value.stopAnimation(), [value]);
  return value;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // Nicht jede Plattform kennt die Abfrage (Web) – dann gilt „normal bewegen“.
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== 'function') return;
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
