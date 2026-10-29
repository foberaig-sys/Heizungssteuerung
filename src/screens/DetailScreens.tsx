import { ScrollView, StyleSheet, Text } from 'react-native';

import { commands } from '../keba/service';
import {
  HeatCircuitModes,
  HotWaterModes,
  modeLabel,
  selectableHeatCircuitModes,
  selectableHotWaterModes,
} from '../keba/variables';
import { useHeating } from '../store';
import { Card, OptionList, Row, SectionTitle, SetpointEditor } from '../ui/components';
import { formatTemp, useTheme } from '../ui/theme';

export function HeatCircuitScreen({ index }: { index: number }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const circuit = snapshot?.heatCircuits.find((c) => c.index === index);
  if (!circuit) return null;

  // Aktuelle Betriebsart immer anzeigen, auch wenn sie in der App nicht wählbar ist (z. B. Urlaub).
  const modes = HeatCircuitModes.filter(
    (m) => selectableHeatCircuitModes.includes(m.value) || m.value === circuit.operatingMode,
  );

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SectionTitle>Status</SectionTitle>
      <Card style={styles.listCard}>
        <Row label="Aktueller Sollwert" value={formatTemp(circuit.currentSetTemperature)} />
        {circuit.roomTemperature !== undefined && <Row label="Raumtemperatur" value={formatTemp(circuit.roomTemperature)} />}
        {circuit.roomHumidity !== undefined && <Row label="Luftfeuchte" value={`${Math.round(circuit.roomHumidity)} %`} />}
        {circuit.flowSetTemperature !== undefined && <Row label="Vorlauf-Soll" value={formatTemp(circuit.flowSetTemperature)} />}
        <Row label="Heizanforderung" value={circuit.heatRequest ? 'Ja' : 'Nein'} last />
      </Card>

      <SectionTitle>Betriebsart</SectionTitle>
      <OptionList
        options={modes}
        selected={circuit.operatingMode}
        disabled={writing}
        onSelect={(mode) => perform((c) => commands.setHeatCircuitMode(c, index, mode))}
      />

      <SectionTitle>Temperaturen</SectionTitle>
      <Card style={styles.listCard}>
        {circuit.normalSetTemperature && (
          <SetpointEditor
            title="Komfort (Tag)"
            setpoint={circuit.normalSetTemperature}
            step={0.5}
            disabled={writing}
            onCommit={(v) => perform((c) => commands.setNormalTemperature(c, index, v))}
          />
        )}
        {circuit.reducedSetTemperature && (
          <SetpointEditor
            title="Absenkung (Nacht)"
            setpoint={circuit.reducedSetTemperature}
            step={0.5}
            disabled={writing}
            onCommit={(v) => perform((c) => commands.setReducedTemperature(c, index, v))}
          />
        )}
        {circuit.offset && (
          <SetpointEditor
            title="Korrektur"
            setpoint={circuit.offset}
            step={0.5}
            unit=" K"
            disabled={writing}
            onCommit={(v) => perform((c) => commands.setOffset(c, index, v))}
          />
        )}
      </Card>
      <Text style={[styles.footnote, { color: theme.secondary }]}>
        Die Korrektur entspricht den Pfeiltasten auf dem Startbildschirm der Heizung. Aktuell:{' '}
        {modeLabel(HeatCircuitModes, circuit.operatingMode)}.
      </Text>
    </ScrollView>
  );
}

export function HotWaterScreen({ index }: { index: number }) {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const tank = snapshot?.hotWaterTanks.find((t) => t.index === index);
  if (!tank) return null;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <SectionTitle>Status</SectionTitle>
      <Card style={styles.listCard}>
        <Row label="Temperatur oben" value={formatTemp(tank.temperature)} />
        <Row label="Wird geheizt" value={tank.heatRequest ? 'Ja' : 'Nein'} last />
      </Card>

      <SectionTitle>Betriebsart</SectionTitle>
      <OptionList
        options={HotWaterModes.filter((m) => selectableHotWaterModes.includes(m.value))}
        selected={tank.operatingMode}
        disabled={writing}
        onSelect={(mode) => perform((c) => commands.setHotWaterMode(c, index, mode))}
      />

      {tank.setTemperature && (
        <>
          <SectionTitle>Temperatur</SectionTitle>
          <Card style={styles.listCard}>
            <SetpointEditor
              title="Solltemperatur"
              setpoint={tank.setTemperature}
              step={1}
              disabled={writing}
              onCommit={(v) => perform((c) => commands.setHotWaterTemperature(c, index, v))}
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  listCard: { paddingVertical: 4 },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 16 },
});
