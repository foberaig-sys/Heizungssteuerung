import { StyleSheet, Text } from 'react-native';

import { useHeating } from '../store';
import { Card, Row, SectionTitle } from '../ui/components';
import { IconSpec, icons } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { formatTemp, type, useTheme } from '../ui/theme';

type RowData = { label: string; value: number | undefined; icon?: IconSpec };

/** Messwerte zum Nachschauen – nichts davon lässt sich hier verstellen. */
export function DataScreen() {
  const { snapshot, refresh } = useHeating();
  const theme = useTheme();
  if (!snapshot) return null;
  const hp = snapshot.heatPump;

  const sections: { title: string; icon: IconSpec; rows: RowData[] }[] = [
    {
      title: 'Wärmepumpe',
      icon: icons.heat,
      rows: [
        { label: 'Vorlauf', value: hp?.flowTemperature },
        { label: 'Rücklauf', value: hp?.returnTemperature },
        { label: 'Luft rein', value: hp?.sourceInTemperature },
        { label: 'Luft raus', value: hp?.sourceOutTemperature },
      ],
    },
    {
      title: 'Puffer',
      icon: icons.thermometer,
      rows: [
        { label: 'Oben', value: hp?.bufferTopTemperature },
        { label: 'Mitte', value: hp?.bufferMidTemperature },
      ],
    },
    {
      title: 'Außen',
      icon: icons.wind,
      rows: [{ label: 'Außentemperatur', value: snapshot.outdoorTemperature }],
    },
    ...snapshot.heatCircuits.map((c) => ({
      title: c.name,
      icon: icons.sun,
      rows: [
        { label: 'Aktueller Sollwert', value: c.currentSetTemperature },
        { label: 'Komfort', value: c.normalSetTemperature?.value },
        { label: 'Absenkung', value: c.reducedSetTemperature?.value },
        { label: 'Raum', value: c.roomTemperature },
        { label: 'Vorlauf-Soll', value: c.flowSetTemperature },
      ],
    })),
    ...snapshot.hotWaterTanks.map((t) => ({
      title: t.name,
      icon: icons.drop,
      rows: [
        { label: 'Ist', value: t.temperature },
        { label: 'Soll', value: t.setTemperature?.value },
      ],
    })),
  ];

  return (
    <Screen title="Daten" onRefresh={refresh}>
      {sections.map((section) => {
        const rows = section.rows.filter((r) => r.value !== undefined);
        if (rows.length === 0) return null;
        return (
          <SectionBlock key={section.title} title={section.title} icon={section.icon}>
            {rows.map((r, i) => (
              <Row key={r.label} label={r.label} value={formatTemp(r.value)} last={i === rows.length - 1} />
            ))}
          </SectionBlock>
        );
      })}
      <Text style={[type.footnote, styles.footer, { color: theme.secondary }]}>
        Stand {snapshot.fetchedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · zum
        Aktualisieren nach unten ziehen
      </Text>
    </Screen>
  );
}

function SectionBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconSpec;
  children: React.ReactNode;
}) {
  return (
    <>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <Card style={styles.list}>{children}</Card>
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 2 },
  footer: { textAlign: 'center', marginTop: 20 },
});
