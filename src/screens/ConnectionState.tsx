import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isConfigured } from '../settings';
import { useSettings } from '../settingsContext';
import { useHeating } from '../store';
import { Button, StatusView } from '../ui/components';
import { icons } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useTheme } from '../ui/theme';

/** Zeigt den Inhalt eines Tabs erst, wenn Daten da sind – sonst Verbindungsstatus mit passender Aktion. */
export function ConnectedScreen({ title, children }: { title: string; children: ReactNode }) {
  const { phase } = useHeating();
  if (phase === 'ready') return <>{children}</>;
  return (
    <Screen title={title}>
      <ConnectionState />
    </Screen>
  );
}

function ConnectionState() {
  const { phase, error, progress, remoteStage, revealPortal, diagnostics, connect } = useHeating();
  const { settings } = useSettings();
  const router = useRouter();
  const openSettings = () => router.navigate('/settings');
  const reconnect = () => (isConfigured(settings) ? void connect(settings) : openSettings());

  switch (phase) {
    case 'loading':
      return (
        <StatusView title={progress || 'Lade Daten …'} loading>
          {remoteStage === 'auto' && (
            <Button
              title="Anmeldeseite anzeigen"
              kind="secondary"
              onPress={() => revealPortal('Du kannst hier zuschauen oder von Hand weitermachen („WebHmi“ → „WWW“).')}
            />
          )}
          <Diagnostics lines={diagnostics} />
        </StatusView>
      );
    case 'failed':
      return (
        <StatusView title="Keine Verbindung" message={error} icon={icons.wifiOff}>
          <Button title="Erneut versuchen" onPress={reconnect} />
          <Button title="Einstellungen" kind="secondary" onPress={openSettings} />
        </StatusView>
      );
    case 'sessionExpired':
      return (
        <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen." icon={icons.wifiOff}>
          <Button title="Neu verbinden" onPress={reconnect} />
        </StatusView>
      );
    default:
      return (
        <StatusView
          title="Nicht verbunden"
          message="Richte einmal die Verbindung ein. Danach verbindet sich die App bei jedem Start von selbst."
          icon={icons.heat}
        >
          <Button title="Einrichten" onPress={openSettings} />
        </StatusView>
      );
  }
}

/** Kleine Liste der letzten Verbindungsereignisse – hilft beim Eingrenzen, falls etwas hängt. */
function Diagnostics({ lines }: { lines: string[] }) {
  const theme = useTheme();
  if (lines.length === 0) return null;
  return (
    <View style={styles.diagnostics}>
      {lines.slice(-4).map((line, i) => (
        <Text key={i} style={[styles.line, { color: theme.secondary }]} numberOfLines={3}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  diagnostics: { marginTop: 12, gap: 4 },
  line: { fontSize: 11 },
});
