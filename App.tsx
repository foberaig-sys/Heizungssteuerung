import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeatCircuitScreen, HotWaterScreen } from './src/screens/DetailScreens';
import { Dashboard } from './src/screens/Dashboard';
import { RemoteHost } from './src/screens/RemoteHost';
import type { Route } from './src/screens/routes';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Settings, defaultSettings, hasPortalCredentials, loadSettings } from './src/settings';
import { HeatingProvider, useHeating } from './src/store';
import { Button, StatusView } from './src/ui/components';
import { useTheme } from './src/ui/theme';

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
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [stack, setStack] = useState<Route[]>([{ name: 'dashboard' }]);
  const route = stack[stack.length - 1];

  const navigate = (next: Route) => setStack((s) => [...s, next]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  // Einstellungen laden und – wenn alles hinterlegt ist – sofort verbinden, ohne dass eine Webseite erscheint.
  useEffect(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      const ready = loaded.mode === 'remote' ? hasPortalCredentials(loaded) : loaded.localAddress !== '';
      if (ready) void heating.connect(loaded);
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
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, heating.remoteStage, heating.cancelRemoteLogin]);

  useEffect(() => {
    if (heating.transientError) {
      Alert.alert('Fehler', heating.transientError, [{ text: 'OK', onPress: heating.clearTransientError }]);
    }
  }, [heating.transientError, heating.clearTransientError]);

  // Detailseiten ergeben ohne Daten keinen Sinn → zurück zur Übersicht.
  useEffect(() => {
    if (heating.phase !== 'ready' && route.name !== 'settings' && stack.length > 1) {
      setStack([{ name: 'dashboard' }]);
    }
  }, [heating.phase, route.name, stack.length]);

  const connect = () => {
    const ready = settings.mode === 'remote' ? hasPortalCredentials(settings) : settings.localAddress !== '';
    if (ready) void heating.connect(settings);
    else navigate({ name: 'settings' });
  };

  const title = (() => {
    switch (route.name) {
      case 'dashboard':
        return 'Heizung';
      case 'settings':
        return 'Einstellungen';
      case 'circuit':
        return heating.snapshot?.heatCircuits.find((c) => c.index === route.index)?.name ?? 'Heizkreis';
      case 'hotWater':
        return heating.snapshot?.hotWaterTanks.find((t) => t.index === route.index)?.name ?? 'Warmwasser';
    }
  })();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: theme.background }]}>
        <View style={styles.headerSide}>
          {stack.length > 1 && (
            <Pressable onPress={back} hitSlop={12}>
              <Text style={[styles.headerButton, { color: theme.accent }]}>‹ Zurück</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.headerSide, styles.headerRight]}>
          {route.name === 'dashboard' && (
            <Pressable onPress={() => navigate({ name: 'settings' })} hitSlop={12} accessibilityLabel="Einstellungen">
              <Text style={[styles.headerButton, { color: theme.accent }]}>⚙︎</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {route.name === 'settings' ? (
          <SettingsScreen settings={settings} onChange={setSettings} onDone={back} />
        ) : route.name === 'circuit' ? (
          <HeatCircuitScreen index={route.index} />
        ) : route.name === 'hotWater' ? (
          <HotWaterScreen index={route.index} />
        ) : (
          <Home connect={connect} navigate={navigate} />
        )}
      </View>

      <RemoteHost />
    </View>
  );
}

function Home({ connect, navigate }: { connect: () => void; navigate: (r: Route) => void }) {
  const { phase, error, progress, remoteStage, revealPortal, diagnostics } = useHeating();

  switch (phase) {
    case 'ready':
      return <Dashboard navigate={navigate} />;
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
        <StatusView title="Keine Verbindung" message={error}>
          <Button title="Erneut versuchen" onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: 'settings' })} />
        </StatusView>
      );
    case 'sessionExpired':
      return (
        <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen.">
          <Button title="Neu verbinden" onPress={connect} />
        </StatusView>
      );
    case 'notConnected':
      return (
        <StatusView
          title="Nicht verbunden"
          message="Trage einmal deinen Zugang zu remote.keba.com ein. Danach verbindet sich die App bei jedem Start von selbst."
        >
          <Button title="Einrichten" onPress={() => navigate({ name: 'settings' })} />
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headerSide: { width: 90 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerButton: { fontSize: 17 },
  body: { flex: 1 },
});
