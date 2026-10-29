import { ComponentType, RefAttributes, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewProps } from 'react-native-webview';

import { REMOTE_PORTAL_URL, hmiBaseUrl } from '../keba/bridge';
import { parsePortalMessage } from '../keba/portalAutomation';
import { useHeating } from '../store';
import { Button } from '../ui/components';
import { useTheme } from '../ui/theme';

// Die Typen von react-native-webview (Klasse mit Generic `P = undefined`) ergeben unter
// TypeScript 6 `never` als Props. Zur Laufzeit ist alles in Ordnung, daher hier sauber typisiert.
const KebaWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

/**
 * Eine einzige WebView für den Fernzugriff. Normalerweise unsichtbar: Sie meldet sich selbst im
 * Secomea-Portal an, öffnet die HMI, hält die Sitzung und führt die API-Aufrufe aus.
 * Sichtbar wird sie nur, wenn keine Zugangsdaten gespeichert sind oder die Automatik scheitert.
 */
export function RemoteHost() {
  const {
    remoteStage,
    remoteSession,
    portalScript,
    loginNotice,
    bridge,
    onHmiReached,
    onHmiLeft,
    onPortalMessage,
    cancelRemoteLogin,
  } = useHeating();
  const webView = useRef<WebView>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const visible = remoteStage === 'login';

  useEffect(() => {
    bridge.attach(remoteStage === 'connected' ? webView.current : null);
  }, [bridge, remoteStage]);

  if (remoteStage === 'idle') return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, visible ? { backgroundColor: theme.background } : styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {visible && (
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.card }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>KEBA Fernzugriff</Text>
            <Button title="Abbrechen" kind="secondary" onPress={cancelRemoteLogin} />
          </View>
          <Text style={[styles.hint, { color: theme.secondary }]}>
            {loginNotice ??
              'Tipp: Trage deine Zugangsdaten in den Einstellungen ein, dann meldet sich die App künftig selbst an. Jetzt: anmelden, Anlage aufklappen, „WebHmi“ und dann „WWW“ antippen.'}
          </Text>
        </View>
      )}
      <KebaWebView
        key={remoteSession}
        ref={webView}
        source={{ uri: REMOTE_PORTAL_URL }}
        style={styles.flex}
        injectedJavaScript={portalScript}
        sharedCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        // „WWW“ öffnet die HMI in einem neuen Fenster; ohne diese Option blockiert iOS den Klick der Automatik.
        javaScriptCanOpenWindowsAutomatically
        setSupportMultipleWindows={false}
        onMessage={(event) => {
          const data = event.nativeEvent.data;
          if (bridge.handleMessage(data)) return;
          const portal = parsePortalMessage(data);
          if (portal) onPortalMessage(portal);
        }}
        onLoadEnd={(event) => {
          const isHmi = hmiBaseUrl(event.nativeEvent.url) !== undefined;
          if ((remoteStage === 'auto' || remoteStage === 'login') && isHmi) {
            bridge.attach(webView.current);
            onHmiReached();
          } else if (remoteStage === 'connected' && !isHmi) {
            onHmiLeft();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Volle Größe (damit das Portal normal layoutet), aber unsichtbar und ohne Berührungen.
  hidden: { opacity: 0.01, zIndex: -1 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 14, marginTop: 6 },
});
