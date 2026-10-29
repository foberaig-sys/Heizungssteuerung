import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconSpec } from './Icon';
import { useTheme } from './theme';

export interface Tab<K extends string> {
  key: K;
  label: string;
  icon: IconSpec;
}

/** Höhe der Leiste ohne Abstand nach unten – Inhalte lassen so viel Platz frei. */
export const TAB_BAR_HEIGHT = 64;
export const useTabBarInset = () => TAB_BAR_HEIGHT + Math.max(useSafeAreaInsets().bottom, 12) + 16;

const FLAGS = {
  reduceMotion: { query: 'isReduceMotionEnabled', event: 'reduceMotionChanged' },
  reduceTransparency: { query: 'isReduceTransparencyEnabled', event: 'reduceTransparencyChanged' },
} as const;

/** iOS-Einstellungen „Bewegung reduzieren“ / „Transparenz reduzieren“ (fehlen auf manchen Plattformen). */
function useAccessibilityFlag(flag: keyof typeof FLAGS) {
  const [value, setValue] = useState(false);
  useEffect(() => {
    const { query, event } = FLAGS[flag];
    const read = AccessibilityInfo[query] as (() => Promise<boolean>) | undefined;
    read?.call(AccessibilityInfo).then(setValue, () => undefined);
    const sub = AccessibilityInfo.addEventListener(event, setValue);
    return () => sub?.remove();
  }, [flag]);
  return value;
}

/**
 * Schwebende, durchscheinende Leiste wie in iOS: Inhalte laufen darunter durch, die Auswahl
 * gleitet mit einer gedämpften Feder (ohne Überschwingen) zum angetippten Punkt.
 */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useAccessibilityFlag('reduceMotion');
  const reduceTransparency = useAccessibilityFlag('reduceTransparency');
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((t) => t.key === active));
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(index);
      return;
    }
    // Feder startet immer vom aktuellen Wert – mehrfaches schnelles Tippen bleibt flüssig.
    Animated.spring(position, { toValue: index, useNativeDriver: true, damping: 26, stiffness: 300, mass: 1 }).start();
  }, [index, position, reduceMotion]);

  const inner = width - 12;
  const itemWidth = tabs.length > 0 ? inner / tabs.length : 0;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, { borderColor: theme.tabBarBorder }]}
        accessibilityRole="tablist"
      >
        {reduceTransparency ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.card }]} />
        ) : (
          <BlurView tint={theme.blurTint} intensity={80} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.tabBar }]} />
          </BlurView>
        )}
        {width > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              {
                width: itemWidth,
                backgroundColor: theme.fill,
                transform: [{ translateX: Animated.multiply(position, itemWidth) }],
              },
            ]}
          />
        )}
        {tabs.map((tab) => {
          const selected = tab.key === active;
          const color = selected ? theme.accent : theme.text;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
            >
              <Icon icon={tab.icon} size={22} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    // Tiefe: größere Fläche, weicher Schatten
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  indicator: { position: 'absolute', left: 6, top: 6, bottom: 6, borderRadius: (TAB_BAR_HEIGHT - 12) / 2 },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, lineHeight: 13, fontWeight: '600', letterSpacing: 0.07 },
});
