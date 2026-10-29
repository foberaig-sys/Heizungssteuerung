import { StatusBar } from 'expo-status-bar';
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { Alert, AppState, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RemoteHost } from '../screens/RemoteHost';
import { isConfigured, loadSettings } from '../settings';
import { SettingsProvider, useSettings } from '../settingsContext';
import { HeatingProvider, useHeating } from '../store';
import { haptic } from '../ui/haptics';
import { useTheme } from '../ui/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <HeatingProvider>
          <Root />
        </HeatingProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const heating = useHeating();
  const { setSettings } = useSettings();
  const theme = useTheme();

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

  // Android-Zurück-Taste schließt zuerst die Anmeldeseite des Fernzugriffs.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (heating.remoteStage !== 'login') return false;
      heating.cancelRemoteLogin();
      return true;
    });
    return () => sub.remove();
  }, [heating.remoteStage, heating.cancelRemoteLogin]);

  useEffect(() => {
    if (heating.transientError) {
      haptic.error();
      Alert.alert('Fehler', heating.transientError, [{ text: 'OK', onPress: heating.clearTransientError }]);
    }
  }, [heating.transientError, heating.clearTransientError]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      {/*
        Echte iOS-Tab-Leiste: ab iOS 26 mit Liquid Glass – die Auswahl gleitet als Glaslinse und lässt
        sich mit dem Finger über die Leiste ziehen. Ältere iOS-Versionen zeigen die klassische Leiste.
      */}
      <NativeTabs tintColor={theme.accent} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
          <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="modes">
          <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
          <NativeTabs.Trigger.Label>Heizarten</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="data">
          <NativeTabs.Trigger.Icon sf="chart.bar.xaxis" md="bar_chart" />
          <NativeTabs.Trigger.Label>Daten</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
          <NativeTabs.Trigger.Label>Einstellungen</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <RemoteHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
