import { ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { ModeOption } from '../keba/variables';
import type { Setpoint } from '../keba/service';
import { formatTemp, useTheme } from './theme';

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const content = (pressed: boolean) => [
    styles.card,
    { backgroundColor: pressed && onPress ? theme.pressed : theme.card },
    style,
  ];
  if (!onPress) return <View style={content(false)}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => content(pressed)}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.secondary }]}>{children.toUpperCase()}</Text>;
}

export function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.secondary }]}>{value}</Text>
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
  const background = kind === 'primary' ? theme.accent : theme.pressed;
  const color = kind === 'primary' ? theme.accentText : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

/** Auswahlliste mit Häkchen, z. B. für Betriebsarten. */
export function OptionList({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: ModeOption[];
  selected: number | undefined;
  onSelect: (value: number) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.listCard}>
      {options.map((option, i) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: option.value === selected, disabled }}
          disabled={disabled}
          onPress={() => option.value !== selected && onSelect(option.value)}
          style={({ pressed }) => [
            styles.row,
            styles.listRow,
            pressed && { backgroundColor: theme.pressed },
            i < options.length - 1 && { borderBottomColor: theme.separator, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <Text style={[styles.rowLabel, { color: disabled ? theme.secondary : theme.text }]}>{option.label}</Text>
          {option.value === selected && <Text style={[styles.check, { color: theme.accent }]}>✓</Text>}
        </Pressable>
      ))}
    </Card>
  );
}

/** − Wert + mit "Übernehmen", damit nicht jeder Zwischenschritt an den Regler geht. */
export function SetpointEditor({
  title,
  setpoint,
  step,
  unit = '°',
  disabled,
  onCommit,
}: {
  title: string;
  setpoint: Setpoint;
  step: number;
  unit?: string;
  disabled?: boolean;
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
    <View style={styles.editor}>
      <View style={styles.editorRow}>
        <Text style={[styles.rowLabel, { color: theme.text, flex: 1 }]}>{title}</Text>
        <StepButton label="−" onPress={() => change(-step)} disabled={disabled || value <= min} />
        <Text style={[styles.editorValue, { color: draft === undefined ? theme.text : theme.accent }]}>
          {formatTemp(value, unit)}
        </Text>
        <StepButton label="+" onPress={() => change(step)} disabled={disabled || value >= max} />
      </View>
      {draft !== undefined && (
        <View style={styles.editorActions}>
          <Button title="Verwerfen" kind="secondary" onPress={() => setDraft(undefined)} style={styles.flex} />
          <Button
            title="Übernehmen"
            disabled={disabled}
            onPress={async () => {
              await onCommit(draft);
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
  label,
  onPress,
  disabled,
  large,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' || label === '▲' ? 'Höher' : 'Niedriger'}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        large ? styles.stepLarge : styles.step,
        { backgroundColor: pressed ? theme.separator : theme.pressed, opacity: disabled ? 0.35 : 1 },
      ]}
    >
      <Text style={[large ? styles.stepLargeText : styles.stepText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function StatusView({
  title,
  message,
  loading,
  children,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.status}>
      {loading && <ActivityIndicator size="large" color={theme.accent} style={{ marginBottom: 16 }} />}
      <Text style={[styles.statusTitle, { color: theme.text }]}>{title}</Text>
      {message && <Text style={[styles.statusMessage, { color: theme.secondary }]}>{message}</Text>}
      <View style={styles.statusActions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  listCard: { padding: 0, overflow: 'hidden' },
  sectionTitle: { fontSize: 13, marginTop: 20, marginBottom: 6, marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  listRow: { paddingHorizontal: 16, minHeight: 48 },
  rowLabel: { fontSize: 17 },
  rowValue: { fontSize: 17, fontVariant: ['tabular-nums'] },
  check: { fontSize: 18, fontWeight: '600' },
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
  editor: { paddingVertical: 10 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorValue: { fontSize: 20, fontWeight: '600', minWidth: 72, textAlign: 'center', fontVariant: ['tabular-nums'] },
  editorActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  step: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '500' },
  stepLarge: { width: 60, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepLargeText: { fontSize: 22, fontWeight: '600' },
  status: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  statusTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  statusMessage: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  statusActions: { marginTop: 24, gap: 12, alignSelf: 'stretch' },
});
