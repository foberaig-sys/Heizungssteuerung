import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { normalizeLocalAddress } from '../keba/client';
import { isModbusAvailable } from '../modbus/nativeSocket';
import { FoundController, scanForControllers, subnetPrefix } from '../keba/discovery';
import { ConnectionMode, Settings, hasPortalCredentials, saveSettings } from '../settings';
import { useHeating } from '../store';
import { Button, Card, SectionTitle } from '../ui/components';
import { useTheme } from '../ui/theme';

export function SettingsScreen({
  settings,
  onChange,
  onDone,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onDone: () => void;
}) {
  const { connect, disconnect, phase } = useHeating();
  const theme = useTheme();
  const [draft, setDraft] = useState(settings);
  const update = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));

  const saveAndConnect = async () => {
    onChange(draft);
    await saveSettings(draft);
    onDone();
    await connect(draft);
  };

  const canConnect =
    draft.mode === 'remote'
      ? true
      : draft.mode === 'modbus'
        ? draft.modbusAddress.trim() !== ''
        : normalizeLocalAddress(draft.localAddress) !== undefined;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>Verbindung</SectionTitle>
      <View style={[styles.segment, { backgroundColor: theme.pressed }]}>
        {(['modbus', 'remote', 'local'] as ConnectionMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => update({ mode })}
            style={[styles.segmentItem, draft.mode === mode && { backgroundColor: theme.card }]}
          >
            <Text style={[styles.segmentText, { color: theme.text }]}>
              {MODE_LABELS[mode]}
            </Text>
          </Pressable>
        ))}
      </View>

      {draft.mode === 'modbus' ? (
        <>
          <SectionTitle>Wärmepumpe im Heimnetz (Modbus)</SectionTitle>
          <Card style={styles.form}>
            <Field
              value={draft.modbusAddress}
              onChangeText={(modbusAddress) => update({ modbusAddress })}
              placeholder="IP-Adresse, z. B. 192.168.0.100"
              keyboardType="numbers-and-punctuation"
            />
            <Field
              value={draft.circuitNames}
              onChangeText={(circuitNames) => update({ circuitNames })}
              placeholder="Heizkreise, z. B. Puffer FBH, Heizkörper"
              last
            />
          </Card>
          <Text style={[styles.footnote, { color: theme.secondary }]}>
            Direkt mit der Wärmepumpe – ohne Website, ohne Passwort. Die IP-Adresse steht am Display unter
            Netzwerk → LAN. Die Namen der Heizkreise (kommagetrennt, in der Reihenfolge am Display) legen fest,
            wie viele Heizkreise angezeigt werden. Funktioniert im WLAN zuhause oder per VPN.
          </Text>
          {!isModbusAvailable() && (
            <Text style={[styles.footnote, { color: theme.danger }]}>
              In Expo Go/Snack gibt es keine direkten Netzwerkverbindungen. Modbus funktioniert erst in der
              eigenen App-Version (EAS Build). Zum Testen in Snack „Fernzugriff“ wählen.
            </Text>
          )}
        </>
      ) : draft.mode === 'remote' ? (
        <>
          <SectionTitle>Zugang remote.keba.com</SectionTitle>
          <Card style={styles.form}>
            <Field
              value={draft.portalUsername}
              onChangeText={(portalUsername) => update({ portalUsername })}
              placeholder="Benutzername"
              textContentType="username"
              autoComplete="username"
            />
            <Field
              value={draft.portalPassword}
              onChangeText={(portalPassword) => update({ portalPassword })}
              placeholder="Passwort"
              secureTextEntry
              textContentType="password"
              autoComplete="password"
            />
            <Field
              value={draft.portalDevice}
              onChangeText={(portalDevice) => update({ portalDevice })}
              placeholder="Geräteeintrag (Standard: WebHmi)"
              last
            />
          </Card>
          <Text style={[styles.footnote, { color: theme.secondary }]}>
            Dieselben Daten wie auf remote.keba.com/app. Die App meldet sich damit unsichtbar selbst an,
            öffnet „WebHmi“ und steuert die Heizung direkt – du siehst die Portal-Seite nicht mehr.
            Das Passwort liegt verschlüsselt im iOS-Schlüsselbund.
          </Text>
        </>
      ) : (
        <>
          <SectionTitle>Regler im Heimnetz</SectionTitle>
          <Card style={styles.form}>
            <Field
              value={draft.localAddress}
              onChangeText={(localAddress) => update({ localAddress })}
              placeholder="Adresse, z. B. https://192.168.0.100"
              keyboardType="url"
            />
            <Field
              value={draft.username}
              onChangeText={(username) => update({ username })}
              placeholder="Benutzer (falls nötig)"
            />
            <Field
              value={draft.password}
              onChangeText={(password) => update({ password })}
              placeholder="Passwort (falls nötig)"
              secureTextEntry
              last
            />
          </Card>
          <Text style={[styles.footnote, { color: theme.secondary }]}>
            Direkt mit dem Regler – am schnellsten und ohne Hersteller-Portal. Funktioniert im WLAN zuhause
            oder unterwegs über ein eigenes VPN (z. B. FRITZ!Box, WireGuard, Tailscale). Neuere Regler
            verlangen https:// und Benutzer/Passwort.
          </Text>
          <ControllerSearch
            address={draft.localAddress}
            onSelect={(url) => update({ localAddress: url.replace(/^http:\/\//, '') })}
          />
        </>
      )}

      <Button
        title={draft.mode === 'remote' && !hasPortalCredentials(draft) ? 'Ohne Speichern im Portal anmelden' : 'Speichern & verbinden'}
        style={styles.action}
        disabled={!canConnect}
        onPress={saveAndConnect}
      />

      {phase !== 'notConnected' && (
        <Button title="Verbindung trennen" kind="danger" style={styles.action} onPress={disconnect} />
      )}
    </ScrollView>
  );
}

/** Durchsucht das WLAN nach dem Regler, falls die IP-Adresse unbekannt ist. */
function ControllerSearch({ address, onSelect }: { address: string; onSelect: (url: string) => void }) {
  const theme = useTheme();
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [results, setResults] = useState<FoundController[]>();
  const cancelled = useRef(false);
  // Netz aus der eingetragenen Adresse, sonst das übliche Netz deines Routers.
  const prefix = subnetPrefix(address) ?? '192.168.0';
  const searching = progress !== undefined;

  const search = async () => {
    cancelled.current = false;
    setResults(undefined);
    setProgress({ done: 0, total: 1 });
    const found = await scanForControllers(prefix, {
      onProgress: (done, total) => setProgress({ done, total }),
      isCancelled: () => cancelled.current,
    });
    setProgress(undefined);
    setResults(found);
  };

  return (
    <View style={styles.search}>
      {searching ? (
        <>
          <Text style={[styles.searchText, { color: theme.text }]}>
            Suche in {prefix}.x … {Math.round((progress.done / progress.total) * 100)} %
          </Text>
          <Button title="Suche abbrechen" kind="secondary" onPress={() => (cancelled.current = true)} />
        </>
      ) : (
        <Button title={`Regler im WLAN suchen (${prefix}.x)`} kind="secondary" onPress={search} />
      )}
      {results?.length === 0 && (
        <Text style={[styles.footnote, { color: theme.secondary }]}>
          Kein Regler gefunden. Ist das Handy im selben WLAN wie die Wärmepumpe (nicht im Gäste-WLAN)?
          Hat iOS gefragt, ob die App „Geräte im lokalen Netzwerk“ finden darf? Das muss erlaubt sein
          (Einstellungen → Datenschutz → Lokales Netzwerk → Expo Go).
        </Text>
      )}
      {results?.map((r) => (
        <Card key={r.url} onPress={() => onSelect(r.url)} style={styles.result}>
          <Text style={[styles.searchText, { color: theme.text }]}>Gefunden: {r.url}</Text>
          <Text style={[styles.footnote, { color: theme.secondary, marginHorizontal: 0 }]}>
            Außentemperatur {r.outdoorTemperature?.toFixed(1).replace('.', ',') ?? '–'}° · antippen zum Übernehmen
          </Text>
        </Card>
      ))}
    </View>
  );
}

const MODE_LABELS: Record<ConnectionMode, string> = {
  modbus: 'Modbus',
  remote: 'Fernzugriff',
  local: 'Web-HMI',
};

function Field({ last, ...props }: TextInputProps & { last?: boolean }) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.secondary}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[
        styles.input,
        { color: theme.text, borderBottomColor: theme.separator, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 4 },
  form: { paddingVertical: 0 },
  input: { fontSize: 17, paddingVertical: 14 },
  action: { marginTop: 20 },
  search: { marginTop: 16, gap: 10 },
  searchText: { fontSize: 16, fontWeight: '500' },
  result: { gap: 2 },
});
