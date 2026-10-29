import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeatCircuitScreen, HotWaterScreen } from './src/screens/DetailScreens';
import { Dashboard } from './src/screens/Dashboard';
import { RemoteHost } from './src/screens/RemoteHost';
import type { Route } from './src/screens/routes';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Settings, defaultSettings, loadSettings } from './src/settings';
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

  // Einstellungen laden und im Heimnetz-Modus direkt verbinden.
  useEffect(() => {
    void loadSettings().then((loaded) => {
      setSettings(loaded);
      if (loaded.mode === 'local' && loaded.localAddress) void heating.connectLocal(loaded);
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
    if (settings.mode === 'remote') heating.startRemoteLogin();
    else if (settings.localAddress) void heating.connectLocal(settings);
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
          <Home connect={connect} navigate={navigate} remote={settings.mode === 'remote'} />
        )}
      </View>

      <RemoteHost />
    </View>
  );
}

function Home({ connect, navigate, remote }: { connect: () => void; navigate: (r: Route) => void; remote: boolean }) {
  const { phase, error, refresh } = useHeating();
  const connectTitle = remote ? 'Über KEBA Fernzugriff verbinden' : 'Verbinden';

  switch (phase) {
    case 'ready':
      return <Dashboard navigate={navigate} />;
    case 'loading':
      return <StatusView title="Lade Daten …" loading />;
    case 'failed':
      return (
        <StatusView title="Keine Verbindung" message={error}>
          <Button title="Erneut versuchen" onPress={() => void refresh()} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: 'settings' })} />
        </StatusView>
      );
    case 'sessionExpired':
      return (
        <StatusView title="Sitzung abgelaufen" message="Der Fernzugriff wurde geschlossen. Bitte neu verbinden.">
          <Button title={connectTitle} onPress={connect} />
        </StatusView>
      );
    case 'notConnected':
      return (
        <StatusView
          title="Nicht verbunden"
          message="Verbinde die App mit deiner Wärmepumpe – über den KEBA Fernzugriff oder direkt im Heimnetz."
        >
          <Button title={connectTitle} onPress={connect} />
          <Button title="Einstellungen" kind="secondary" onPress={() => navigate({ name: 'settings' })} />
        </StatusView>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headerSide: { width: 90 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  headerButton: { fontSize: 17 },
  body: { flex: 1 },
});
