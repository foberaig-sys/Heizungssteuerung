import { useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HeatCircuitStatus, HotWaterStatus } from '../keba/service';
import { commands } from '../keba/service';
import { HeatCircuitModes, HotWaterModes, SystemModes, modeLabel, selectableSystemModes } from '../keba/variables';
import { useHeating } from '../store';
import { Card, OptionList, StepButton } from '../ui/components';
import { formatSigned, formatTemp, useTheme } from '../ui/theme';
import type { Route } from './routes';

export function Dashboard({ navigate }: { navigate: (route: Route) => void }) {
  const { snapshot, refresh, writing, offline } = useHeating();
  const theme = useTheme();
  const [pulling, setPulling] = useState(false);

  // Solange das Dashboard sichtbar ist, alle 30 s aktualisieren.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!snapshot) return null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          tintColor={theme.accent}
          onRefresh={async () => {
            setPulling(true);
            await refresh();
            setPulling(false);
          }}
        />
      }
    >
      <SystemCard />
      {snapshot.heatCircuits.map((circuit) => (
        <HeatCircuitCard key={circuit.index} circuit={circuit} onPress={() => navigate({ name: 'circuit', index: circuit.index })} />
      ))}
      {snapshot.hotWaterTanks.map((tank) => (
        <HotWaterCard key={tank.index} tank={tank} onPress={() => navigate({ name: 'hotWater', index: tank.index })} />
      ))}
      <Text style={[styles.footer, { color: theme.secondary }]}>
        {writing
          ? 'Wird gespeichert …'
          : `${offline ? 'Keine Verbindung – letzter Stand' : 'Stand'}: ${snapshot.fetchedAt.toLocaleTimeString('de-DE')}`}
      </Text>
    </ScrollView>
  );
}

function SystemCard() {
  const { snapshot, perform, writing } = useHeating();
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  if (!snapshot) return null;

  return (
    <Card style={styles.systemCard}>
      <View>
        <Text style={[styles.caption, { color: theme.secondary }]}>Außen</Text>
        <Text style={[styles.mediumTemp, { color: theme.text }]}>{formatTemp(snapshot.outdoorTemperature)}</Text>
      </View>
      {/* Über Modbus ist die Anlagen-Betriebsart (noch) nicht bekannt → Auswahl ausblenden. */}
      {snapshot.systemOperatingMode !== undefined && (
        <Pressable onPress={() => setPicking(true)} disabled={writing} style={styles.systemMode} hitSlop={8}>
          <Text style={[styles.caption, { color: theme.secondary }]}>Anlage</Text>
          <Text style={[styles.systemModeText, { color: theme.accent }]}>
            {modeLabel(SystemModes, snapshot.systemOperatingMode)} ▾
          </Text>
        </Pressable>
      )}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            <Text style={[styles.sheetTitle, { color: '#fff' }]}>Betriebsart der Anlage</Text>
            <OptionList
              options={SystemModes.filter((m) => selectableSystemModes.includes(m.value))}
              selected={snapshot.systemOperatingMode}
              onSelect={(mode) => {
                setPicking(false);
                void perform((c) => commands.setSystemMode(c, mode));
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </Card>
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
      offset
        ? commands.setOffset(c, circuit.index, next)
        : commands.setNormalTemperature(c, circuit.index, next),
    );
  };

  return (
    <Card onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {circuit.name}
          {circuit.heatRequest ? '  🔥' : ''}
        </Text>
        <Text style={[styles.caption, { color: theme.secondary }]}>
          {modeLabel(HeatCircuitModes, circuit.operatingMode)} ›
        </Text>
      </View>
      <View style={styles.circuitBody}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bigTemp, { color: theme.accent }]}>{formatTemp(circuit.currentSetTemperature)}</Text>
          {offset && offset.value !== 0 && (
            <Text style={[styles.caption, { color: theme.secondary }]}>Korrektur {formatSigned(offset.value)}</Text>
          )}
          {circuit.roomTemperature !== undefined && (
            <Text style={[styles.subline, { color: theme.secondary }]}>Raum {formatTemp(circuit.roomTemperature)}</Text>
          )}
        </View>
        {target && (
          <View style={styles.steps}>
            <StepButton large label="▲" onPress={() => step(0.5)} disabled={writing} />
            <StepButton large label="▼" onPress={() => step(-0.5)} disabled={writing} />
          </View>
        )}
      </View>
    </Card>
  );
}

function HotWaterCard({ tank, onPress }: { tank: HotWaterStatus; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} style={styles.waterCard}>
      <Text style={[styles.drop, { color: theme.water }]}>💧</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {tank.name}
          {tank.heatRequest ? '  🔥' : ''}
        </Text>
        <Text style={[styles.caption, { color: theme.secondary }]}>
          Soll {formatTemp(tank.setTemperature?.value)} · {modeLabel(HotWaterModes, tank.operatingMode)}
        </Text>
      </View>
      <Text style={[styles.mediumTemp, { color: theme.text }]}>{formatTemp(tank.temperature)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  systemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  systemMode: { alignItems: 'flex-end', flexShrink: 1, marginLeft: 12 },
  systemModeText: { fontSize: 17, fontWeight: '600', textAlign: 'right' },
  caption: { fontSize: 14 },
  subline: { fontSize: 16, marginTop: 2 },
  mediumTemp: { fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bigTemp: { fontSize: 64, fontWeight: '500', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  circuitBody: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  steps: { gap: 10 },
  waterCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  drop: { fontSize: 28 },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { gap: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
