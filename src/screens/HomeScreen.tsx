import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HeatCircuitStatus, HotWaterStatus } from '../keba/service';
import { commands } from '../keba/service';
import { useHeating } from '../store';
import { Card, StepButton } from '../ui/components';
import { Icon, IconSpec, icons } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { formatTemp, type, useTheme } from '../ui/theme';
import { heatCircuitModeTiles, hotWaterModeTiles, systemModeTiles, tileIcon, tileLabel } from './modeOptions';
import type { Route } from './routes';

export function HomeScreen({ navigate }: { navigate: (route: Route) => void }) {
  const { snapshot, refresh, writing, offline } = useHeating();
  const theme = useTheme();

  // Solange die Startseite sichtbar ist, alle 30 s aktualisieren.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!snapshot) return null;

  return (
    <Screen title="Heizung" onRefresh={refresh}>
      <View style={styles.stack}>
        <OverviewCard />
        {snapshot.heatCircuits.map((circuit) => (
          <HeatCircuitCard key={circuit.index} circuit={circuit} onPress={() => navigate({ name: 'circuit', index: circuit.index })} />
        ))}
        {snapshot.hotWaterTanks.map((tank) => (
          <HotWaterCard key={tank.index} tank={tank} onPress={() => navigate({ name: 'hotWater', index: tank.index })} />
        ))}
        <Text style={[type.footnote, styles.footer, { color: offline ? theme.danger : theme.secondary }]}>
          {writing
            ? 'Wird gespeichert …'
            : `${offline ? 'Keine Verbindung – letzter Stand' : 'Aktualisiert'} ${snapshot.fetchedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
        </Text>
      </View>
    </Screen>
  );
}

function OverviewCard() {
  const { snapshot } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;
  const systemIcon = tileIcon(systemModeTiles, snapshot.systemOperatingMode);

  return (
    <Card>
      <View style={styles.overview}>
        <Metric label="Außen" value={formatTemp(snapshot.outdoorTemperature)} icon={icons.thermometer} />
        {snapshot.heatPump?.bufferTopTemperature !== undefined && (
          <Metric label="Puffer" value={formatTemp(snapshot.heatPump.bufferTopTemperature)} icon={icons.heat} />
        )}
      </View>
      {snapshot.systemOperatingMode !== undefined && (
        <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
          {systemIcon && <Icon icon={systemIcon} size={14} color={theme.accent} />}
          <Text style={[type.footnote, styles.chipText, { color: theme.accent }]}>
            {tileLabel(systemModeTiles, snapshot.systemOperatingMode)}
          </Text>
        </View>
      )}
    </Card>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: IconSpec }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      <View style={styles.metricLabel}>
        <Icon icon={icon} size={14} color={theme.secondary} />
        <Text style={[type.footnote, { color: theme.secondary }]}>{label}</Text>
      </View>
      <Text style={[type.displaySmall, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ModeChip({ label, icon }: { label: string; icon?: IconSpec }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, styles.chipInline, { backgroundColor: theme.fill }]}>
      {icon && <Icon icon={icon} size={13} color={theme.secondary} />}
      <Text style={[type.caption, { color: theme.secondary }]}>{label}</Text>
    </View>
  );
}

function HeatCircuitCard({ circuit, onPress }: { circuit: HeatCircuitStatus; onPress: () => void }) {
  const { perform, writing } = useHeating();
  const theme = useTheme();
  const offset = circuit.offset;
  // Pfeiltasten: wie an der HMI die Korrektur – über Modbus ist die nicht bekannt, dann die Komforttemperatur.
  const target = offset ?? circuit.normalSetTemperature;

  const step = (delta: number) => {
    if (!target) return;
    let next = target.value + delta;
    if (target.range) next = Math.min(target.range.max, Math.max(target.range.min, next));
    if (next === target.value) return;
    void perform((c) =>
      offset ? commands.setOffset(c, circuit.index, next) : commands.setNormalTemperature(c, circuit.index, next),
    );
  };

  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={[type.headline, styles.flexShrink, { color: theme.text }]} numberOfLines={1}>
          {circuit.name}
        </Text>
        {circuit.heatRequest && <Icon icon={icons.flame} size={15} color={theme.accent} />}
        <View style={styles.flex} />
        <ModeChip
          label={tileLabel(heatCircuitModeTiles, circuit.operatingMode)}
          icon={tileIcon(heatCircuitModeTiles, circuit.operatingMode)}
        />
        <Icon icon={icons.forward} size={13} color={theme.tertiary} />
      </View>
      <View style={styles.circuitBody}>
        <View style={styles.flex}>
          <Text style={[type.display, { color: theme.accent }]}>{formatTemp(circuit.currentSetTemperature)}</Text>
          <Text style={[type.footnote, { color: theme.secondary }]}>
            {[
              circuit.normalSetTemperature && `Komfort ${formatTemp(circuit.normalSetTemperature.value)}`,
              circuit.reducedSetTemperature && `Absenkung ${formatTemp(circuit.reducedSetTemperature.value)}`,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        </View>
        {target && (
          <View style={styles.steps}>
            <StepButton large icon={icons.up} label="Wärmer" onPress={() => step(0.5)} disabled={writing} />
            <StepButton large icon={icons.down} label="Kühler" onPress={() => step(-0.5)} disabled={writing} />
          </View>
        )}
      </View>
    </Card>
  );
}

function HotWaterCard({ tank, onPress }: { tank: HotWaterStatus; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeader}>
        <Icon icon={icons.drop} size={16} color={theme.water} />
        <Text style={[type.headline, styles.flexShrink, { color: theme.text }]} numberOfLines={1}>
          {tank.name}
        </Text>
        {tank.heatRequest && <Icon icon={icons.flame} size={15} color={theme.accent} />}
        <View style={styles.flex} />
        <ModeChip label={tileLabel(hotWaterModeTiles, tank.operatingMode)} icon={tileIcon(hotWaterModeTiles, tank.operatingMode)} />
        <Icon icon={icons.forward} size={13} color={theme.tertiary} />
      </View>
      <View style={styles.waterBody}>
        <Text style={[type.display, { color: theme.text }]}>{formatTemp(tank.temperature)}</Text>
        {tank.setTemperature && (
          <Text style={[type.footnote, { color: theme.secondary }]}>Soll {formatTemp(tank.setTemperature.value)}</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  overview: { flexDirection: 'row' },
  metric: { flex: 1, gap: 2 },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  chipText: { fontWeight: '600' },
  chipInline: { marginTop: 0, paddingHorizontal: 8, paddingVertical: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circuitBody: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  steps: { gap: 8 },
  waterBody: { marginTop: 6 },
  footer: { textAlign: 'center', marginTop: 4 },
});
