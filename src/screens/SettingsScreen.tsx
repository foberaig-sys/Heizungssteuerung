import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { isModbusAvailable } from '../modbus/nativeSocket';
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

  const canConnect = draft.mode === 'remote' || draft.modbusAddress.trim() !== '';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>Verbindung</SectionTitle>
      <View style={[styles.segment, { backgroundColor: theme.pressed }]}>
        {(['modbus', 'remote'] as ConnectionMode[]).map((mode) => (
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
      ) : (
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

const MODE_LABELS: Record<ConnectionMode, string> = {
  modbus: 'Modbus',
  remote: 'KEBA Fernzugriff',
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
});
