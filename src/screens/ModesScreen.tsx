import { StyleSheet, Text } from 'react-native';

import { commands } from '../keba/service';
import { KebaVar } from '../keba/variables';
import { useHeating } from '../store';
import { ModeTiles, SectionTitle } from '../ui/components';
import { icons } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { type, useTheme } from '../ui/theme';
import { heatCircuitModeTiles, hotWaterModeTiles, systemModeTiles } from './modeOptions';

const LOCKED = 'Kann über diese Verbindung nicht umgestellt werden – bitte am Display.';

/** Alle Betriebsarten auf einer Seite, mit denselben Symbolen wie am Display. */
export function ModesScreen() {
  const { snapshot, perform, writing, canWrite, refresh } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;

  const systemWritable = canWrite(KebaVar.systemOperatingMode);

  return (
    <Screen title="Heizarten" onRefresh={refresh}>
      {snapshot.systemOperatingMode !== undefined && (
        <>
          <SectionTitle icon={icons.heat}>Anlage</SectionTitle>
          <ModeTiles
            options={systemModeTiles}
            selected={snapshot.systemOperatingMode}
            disabled={writing || !systemWritable}
            onSelect={(mode) => perform((c) => commands.setSystemMode(c, mode))}
          />
          <Text style={[type.footnote, styles.note, { color: theme.secondary }]}>
            {systemWritable ? 'Warmwasser = Sommerbetrieb ohne Heizung. Standby = alles aus (Frostschutz).' : LOCKED}
          </Text>
        </>
      )}

      {snapshot.heatCircuits.map((circuit) => {
        const writable = canWrite(KebaVar.heatCircuit.operatingMode(circuit.index));
        return (
          <ModeSection key={`hc-${circuit.index}`} title={circuit.name} note={writable ? undefined : LOCKED}>
            <ModeTiles
              options={heatCircuitModeTiles}
              selected={circuit.operatingMode}
              disabled={writing || !writable}
              onSelect={(mode) => perform((c) => commands.setHeatCircuitMode(c, circuit.index, mode))}
            />
          </ModeSection>
        );
      })}

      {snapshot.hotWaterTanks.map((tank) => {
        const writable = canWrite(KebaVar.hotWaterTank.operatingMode(tank.index));
        return (
          <ModeSection
            key={`hw-${tank.index}`}
            title={tank.name}
            note={writable ? 'Aufheizen = einmalig auf die Solltemperatur bringen.' : LOCKED}
          >
            <ModeTiles
              options={hotWaterModeTiles}
              selected={tank.operatingMode}
              disabled={writing || !writable}
              onSelect={(mode) => perform((c) => commands.setHotWaterMode(c, tank.index, mode))}
            />
          </ModeSection>
        );
      })}
    </Screen>
  );
}

function ModeSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      {children}
      {note && <Text style={[type.footnote, styles.note, { color: theme.secondary }]}>{note}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 8, marginHorizontal: 18 },
});
