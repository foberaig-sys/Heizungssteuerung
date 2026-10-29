import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataScreen } from './src/screens/DataScreen';
import { HeatCircuitScreen, HotWaterScreen } from './src/screens/DetailScreens';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModesScreen } from './src/screens/ModesScreen';
import { RemoteHost } from './src/screens/RemoteHost';
import type { Route, TabKey } from './src/screens/routes';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Settings, defaultSettings, isConfigured, loadSettings } from './src/settings';
import { HeatingProvider, useHeating } from './src/store';
import { Button, StatusView } from './src/ui/components';
import { haptic } from './src/ui/haptics';
import { icons } from './src/ui/Icon';
import { Screen } from './src/ui/Screen';
import { Tab, TabBar } from './src/ui/TabBar';
import { useTheme } from './src/ui/theme';

const TABS: Tab<TabKey>[] = [
  { key: 'home', label: 'Start', icon: icons.home },
  { key: 'modes', label: 'Heizarten', icon: icons.modes },
  { key: 'data', label: 'Daten', icon: icons.data },
  { key: 'settings', label: 'Einstellungen', icon: icons.settings },
];

const TITLES: Record<TabKey, string> = {
  home: 'Heizung',
  modes: 'Heizarten',
  data: 'Daten',
  settings: 'Einstellungen',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <HeatingProvider>
        <Main />
      </HeatingProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const heating = useHeating();
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [tab, setTab] = useState<TabKey>('home');
  // Unterseite der Startseite (Temperaturen eines Heizkreises bzw. des Warmwassers).
  const [detail, setDetail] = useState<Route | null>(null);

  // Einstellungen laden und – wenn alles hinterlegt ist – sofort verbinden.
  useEffect(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      if (isConfigured(loaded)) void heating.connect(loaded);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beim Zurückkehren in die App sofort aktualisieren.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void heating.refresh();
    });
    return () => sub.remove();
  }, [heating.refresh]);

  // Android-Zurück-Taste
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (heating.remoteStage === 'login') {
        heating.cancelRemoteLogin();
        return true;
      }
      if (detail) {
        setDetail(null);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [detail, tab, heating.remoteStage, heating.cancelRemoteLogin]);

  useEffect(() => {
    if (heating.transientError) {
      haptic.error();
      Alert.alert('Fehler', heating.transientError, [{ text: 'OK', onPress: heating.clearTransientError }]);
    }
  }, [heating.transientError, heating.clearTransientError]);

  // Unterseiten ergeben ohne Daten keinen Sinn → zurück zur Startseite.
  useEffect(() => {
    if (heating.phase !== 'ready') setDetail(null);
  }, [heating.phase]);

  const connect = () => {
    if (isConfigured(settings)) void heating.connect(settings);
    else setTab('settings');
  };

  const selectTab = (next: TabKey) => {
    // Erneutes Tippen auf „Start“ führt zurück zur Übersicht, wie in iOS.
    if (next === tab && next === 'home') setDetail(null);
    setTab(next);
  };

  let content: React.ReactNode;
  if (tab === 'settings') {
    content = (
      <SettingsScreen settings={settings} onChange={setSettings} onDone={() => setTab('home')} />
    );
  } else if (heating.phase !== 'ready') {
    content = (
      <Screen title={TITLES[tab]}>
        <ConnectionState connect={connect} openSettings={() => setTab('settings')} />
      </Screen>
    );
  } else if (tab === 'modes') {
    content = <ModesScreen />;
  } else if (tab === 'data') {
    content = <DataScreen />;
  } else if (detail?.name === 'circuit') {
    content = <HeatCircuitScreen index={detail.index} onBack={() => setDetail(null)} />;
  } else if (detail?.name === 'hotWater') {
    content = <HotWaterScreen index={detail.index} onBack={() => setDetail(null)} />;
  } else {
    content = <HomeScreen navigate={setDetail} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={styles.root}>{content}</View>
      <TabBar tabs={TABS} active={tab} onChange={selectTab} />
      <RemoteHost />
    </View>
  );
}

function ConnectionState({ connect, openSettings }: { connect: () => void; openSettings: () => void }) {
  const { phase, error, progress, remoteStage, revealPortal, diagnostics } = useHeating();

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
          <Button title="Erneut versuchen" onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={openSettings} />
        </StatusView>
      );
    case 'sessionExpired':
      return (
        <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen." icon={icons.wifiOff}>
          <Button title="Neu verbinden" onPress={connect} />
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
        <Text key={i} style={[styles.diagnosticLine, { color: theme.secondary }]} numberOfLines={3}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  diagnostics: { marginTop: 12, gap: 4 },
  diagnosticLine: { fontSize: 11 },
});
