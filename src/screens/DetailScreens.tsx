import { Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { commands } from '../keba/service';
import { useHeating } from '../store';
import { Card, SectionTitle, SetpointEditor } from '../ui/components';
import { Screen } from '../ui/Screen';
import { type, useTheme } from '../ui/theme';

/** Temperaturen eines Heizkreises einstellen. Die Betriebsart liegt im Tab „Heizarten“. */
export function HeatCircuitScreen({ index }: { index: number }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const circuit = snapshot?.heatCircuits.find((c) => c.index === index);
  if (!circuit) return null;

  const editors = [
    circuit.normalSetTemperature && {
      key: 'normal',
      title: 'Komfort (Sonne)',
      setpoint: circuit.normalSetTemperature,
      unit: '°',
      commit: (v: number) => perform((c) => commands.setNormalTemperature(c, index, v)),
    },
    circuit.reducedSetTemperature && {
      key: 'reduced',
      title: 'Absenkung (Mond)',
      setpoint: circuit.reducedSetTemperature,
      unit: '°',
      commit: (v: number) => perform((c) => commands.setReducedTemperature(c, index, v)),
    },
    circuit.offset && {
      key: 'offset',
      title: 'Korrektur',
      setpoint: circuit.offset,
      unit: ' K',
      commit: (v: number) => perform((c) => commands.setOffset(c, index, v)),
    },
  ].filter((e): e is NonNullable<typeof e> => Boolean(e));

  return (
    <Screen title={circuit.name} largeTitle={false}>
      <Stack.Screen options={{ title: circuit.name }} />
      <SectionTitle>Temperaturen</SectionTitle>
      <Card style={styles.list}>
        {editors.map((e, i) => (
          <SetpointEditor
            key={e.key}
            title={e.title}
            setpoint={e.setpoint}
            step={0.5}
            unit={e.unit}
            disabled={writing}
            last={i === editors.length - 1}
            onCommit={e.commit}
          />
        ))}
      </Card>
      <Text style={[type.footnote, styles.note, { color: theme.secondary }]}>
        Komfort gilt bei Sonne und in den Komfortzeiten der Automatik, Absenkung bei Mond und nachts. Die
        Betriebsart stellst du unter „Heizarten“ um.
      </Text>
    </Screen>
  );
}

export function HotWaterScreen({ index }: { index: number }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const tank = snapshot?.hotWaterTanks.find((t) => t.index === index);
  if (!tank) return null;

  return (
    <Screen title={tank.name} largeTitle={false}>
      <Stack.Screen options={{ title: tank.name }} />
      {tank.setTemperature && (
        <>
          <SectionTitle>Temperatur</SectionTitle>
          <Card style={styles.list}>
            <SetpointEditor
              title="Solltemperatur"
              setpoint={tank.setTemperature}
              step={1}
              disabled={writing}
              last
              onCommit={(v) => perform((c) => commands.setHotWaterTemperature(c, index, v))}
            />
          </Card>
        </>
      )}
      <Text style={[type.footnote, styles.note, { color: theme.secondary }]}>
        Die Betriebsart (z. B. einmal aufheizen) stellst du unter „Heizarten“ um.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 2 },
  note: { marginTop: 8, marginHorizontal: 18 },
});
