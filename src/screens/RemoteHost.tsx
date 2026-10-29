import { ComponentType, RefAttributes, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewProps } from 'react-native-webview';

import { REMOTE_PORTAL_URL, hmiBaseUrl } from '../keba/bridge';
import { useHeating } from '../store';
import { Button } from '../ui/components';
import { useTheme } from '../ui/theme';

// Die Typen von react-native-webview (Klasse mit Generic `P = undefined`) ergeben unter
// TypeScript 6 `never` als Props. Zur Laufzeit ist alles in Ordnung, daher hier sauber typisiert.
const KebaWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

/**
 * Eine einzige WebView für den Fernzugriff:
 * - beim Anmelden bildschirmfüllend (Secomea-Portal → „WebHmi“ → „WWW“),
 * - danach unsichtbar im Hintergrund. Sie hält die Sitzung und führt die API-Aufrufe aus.
 */
export function RemoteHost() {
  const { remoteStage, remoteSession, bridge, onHmiReached, onHmiLeft, cancelRemoteLogin } = useHeating();
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
      style={visible ? [StyleSheet.absoluteFill, { backgroundColor: theme.background }] : styles.hidden}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {visible && (
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.card }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>KEBA Fernzugriff</Text>
            <Button title="Abbrechen" kind="secondary" onPress={cancelRemoteLogin} />
          </View>
          <Text style={[styles.hint, { color: theme.secondary }]}>
            Anmelden, Anlage aufklappen, „WebHmi“ und dann „WWW“ antippen.
          </Text>
        </View>
      )}
      <KebaWebView
        key={remoteSession}
        ref={webView}
        source={{ uri: REMOTE_PORTAL_URL }}
        style={styles.flex}
        sharedCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => bridge.handleMessage(event.nativeEvent.data)}
        onLoadEnd={(event) => {
          const isHmi = hmiBaseUrl(event.nativeEvent.url) !== undefined;
          if (remoteStage === 'login' && isHmi) {
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
  // Nicht 0×0 und nicht außerhalb des Bildschirms, damit iOS die Seite nicht anhält.
  hidden: { position: 'absolute', left: 0, bottom: 0, width: 2, height: 2, opacity: 0.01 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { fontSize: 14, marginTop: 6 },
});
