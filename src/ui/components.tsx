import { ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { Setpoint } from '../keba/service';
import { haptic } from './haptics';
import { Icon, IconSpec, icons } from './Icon';
import { formatTemp, type, useTheme } from './theme';

/** Rückmeldung schon beim Aufsetzen des Fingers: leicht kleiner, leicht dunkler. */
const pressedStyle = { transform: [{ scale: 0.98 }], opacity: 0.85 };

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const base = [styles.card, { backgroundColor: theme.card }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && pressedStyle]}>
      {children}
    </Pressable>
  );
}

/** Große, linksbündige Überschrift wie in iOS-Apps. */
export function LargeTitle({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={[type.largeTitle, styles.largeTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function SectionTitle({ children, icon }: { children: string; icon?: IconSpec }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      {icon && <Icon icon={icon} size={15} color={theme.secondary} />}
      <Text style={[type.footnote, styles.sectionText, { color: theme.secondary }]}>{children.toUpperCase()}</Text>
    </View>
  );
}

export function Row({ label, value, icon, last }: { label: string; value: string; icon?: IconSpec; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {icon && (
        <View style={styles.rowIcon}>
          <Icon icon={icon} size={17} color={theme.secondary} />
        </View>
      )}
      <Text style={[type.body, styles.flex, { color: theme.text }]}>{label}</Text>
      <Text style={[type.body, styles.tabular, { color: theme.secondary }]}>{value}</Text>
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const background = kind === 'primary' ? theme.accent : theme.fill;
  const color = kind === 'primary' ? theme.accentText : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : 1 },
        pressed && pressedStyle,
        style,
      ]}
    >
      <Text style={[type.headline, { color }]}>{title}</Text>
    </Pressable>
  );
}

export interface ModeTile {
  value: number;
  label: string;
  icon: IconSpec;
}

/**
 * Betriebsarten als Kacheln mit Symbol – dieselben Symbole wie am Display der Wärmepumpe,
 * damit man sie sofort wiedererkennt.
 */
export function ModeTiles({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: ModeTile[];
  selected: number | undefined;
  onSelect: (value: number) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.tiles} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === selected;
        const color = active ? theme.accentText : theme.text;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={option.label}
            disabled={disabled}
            onPress={() => {
              if (active) return;
              haptic.select();
              onSelect(option.value);
            }}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: active ? theme.accent : theme.card, opacity: disabled && !active ? 0.5 : 1 },
              pressed && !active && pressedStyle,
            ]}
          >
            <Icon icon={option.icon} size={24} color={active ? theme.accentText : theme.accent} />
            <Text style={[type.caption, styles.tileLabel, { color }]} numberOfLines={2}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − Wert + mit „Übernehmen“, damit nicht jeder Zwischenschritt an den Regler geht. */
export function SetpointEditor({
  title,
  setpoint,
  step,
  unit = '°',
  disabled,
  last,
  onCommit,
}: {
  title: string;
  setpoint: Setpoint;
  step: number;
  unit?: string;
  disabled?: boolean;
  last?: boolean;
  onCommit: (value: number) => Promise<void>;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<number | undefined>();
  const value = draft ?? setpoint.value;
  const min = setpoint.range?.min ?? setpoint.value - 20;
  const max = setpoint.range?.max ?? setpoint.value + 20;
  const change = (delta: number) => {
    const next = Math.round(Math.min(max, Math.max(min, value + delta)) * 100) / 100;
    setDraft(next === setpoint.value ? undefined : next);
  };

  return (
    <View style={[styles.editor, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.editorRow}>
        <Text style={[type.body, styles.flex, { color: theme.text }]}>{title}</Text>
        <StepButton icon={icons.minus} label="Niedriger" onPress={() => change(-step)} disabled={disabled || value <= min} />
        <Text style={[type.headline, styles.editorValue, { color: draft === undefined ? theme.text : theme.accent }]}>
          {formatTemp(value, unit)}
        </Text>
        <StepButton icon={icons.plus} label="Höher" onPress={() => change(step)} disabled={disabled || value >= max} />
      </View>
      {draft !== undefined && (
        <View style={styles.editorActions}>
          <Button title="Verwerfen" kind="secondary" onPress={() => setDraft(undefined)} style={styles.flex} />
          <Button
            title="Übernehmen"
            disabled={disabled}
            onPress={async () => {
              await onCommit(draft);
              haptic.success();
              setDraft(undefined);
            }}
            style={styles.flex}
          />
        </View>
      )}
    </View>
  );
}

export function StepButton({
  icon,
  label,
  onPress,
  disabled,
  large,
}: {
  icon: IconSpec;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        large ? styles.stepLarge : styles.step,
        { backgroundColor: theme.fill, opacity: disabled ? 0.35 : 1 },
        pressed && { backgroundColor: theme.pressed, transform: [{ scale: 0.94 }] },
      ]}
    >
      <Icon icon={icon} size={large ? 22 : 16} color={theme.text} />
    </Pressable>
  );
}

export function StatusView({
  title,
  message,
  icon,
  loading,
  children,
}: {
  title: string;
  message?: string;
  icon?: IconSpec;
  loading?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.status}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={styles.statusIcon} />
      ) : (
        icon && (
          <View style={styles.statusIcon}>
            <Icon icon={icon} size={44} color={theme.tertiary} />
          </View>
        )
      )}
      <Text style={[type.title2, styles.center, { color: theme.text }]}>{title}</Text>
      {message && <Text style={[type.subhead, styles.center, styles.statusMessage, { color: theme.secondary }]}>{message}</Text>}
      <View style={styles.statusActions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  card: { borderRadius: 22, padding: 18, borderCurve: 'continuous' },
  largeTitle: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 8, marginLeft: 18 },
  sectionText: { letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 11 },
  rowIcon: { width: 28 },
  button: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', borderCurve: 'continuous' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  tileLabel: { textAlign: 'center' },
  editor: { paddingVertical: 12 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorValue: { minWidth: 70, textAlign: 'center', fontVariant: ['tabular-nums'] },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepLarge: { width: 56, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  status: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 96, paddingBottom: 32 },
  statusIcon: { marginBottom: 16 },
  statusMessage: { marginTop: 8 },
  statusActions: { marginTop: 28, gap: 12, alignSelf: 'stretch' },
});
