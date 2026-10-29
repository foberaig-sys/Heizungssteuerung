import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeLocalAddress } from '../keba/client';
import { ConnectionMode, Settings, saveSettings } from '../settings';
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
  const { connectLocal, startRemoteLogin, disconnect, phase } = useHeating();
  const theme = useTheme();
  const [draft, setDraft] = useState(settings);
  const update = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));

  const persist = async () => {
    onChange(draft);
    await saveSettings(draft);
  };

  const inputStyle = [styles.input, { color: theme.text, borderBottomColor: theme.separator }];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>Verbindung</SectionTitle>
      <View style={[styles.segment, { backgroundColor: theme.pressed }]}>
        {(['remote', 'local'] as ConnectionMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => update({ mode })}
            style={[styles.segmentItem, draft.mode === mode && { backgroundColor: theme.card }]}
          >
            <Text style={[styles.segmentText, { color: theme.text }]}>
              {mode === 'remote' ? 'KEBA Fernzugriff' : 'Heimnetz / VPN'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.footnote, { color: theme.secondary }]}>
        {draft.mode === 'remote'
          ? 'Nutzt deinen Zugang zu remote.keba.com. Du meldest dich in der App im Portal an, danach steuert die App die Heizung direkt. Die Sitzung läuft nach einiger Zeit ab.'
          : 'Direkt mit dem Regler – schneller und ohne Hersteller-Portal. Funktioniert im WLAN zuhause oder unterwegs über ein eigenes VPN (z. B. FRITZ!Box, WireGuard, Tailscale).'}
      </Text>

      {draft.mode === 'local' ? (
        <>
          <SectionTitle>Regler im Heimnetz</SectionTitle>
          <Card style={styles.form}>
            <TextInput
              style={inputStyle}
              value={draft.localAddress}
              onChangeText={(localAddress) => update({ localAddress })}
              placeholder="IP-Adresse, z. B. 192.168.1.50"
              placeholderTextColor={theme.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TextInput
              style={inputStyle}
              value={draft.username}
              onChangeText={(username) => update({ username })}
              placeholder="Benutzer (falls nötig)"
              placeholderTextColor={theme.secondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[...inputStyle, { borderBottomWidth: 0 }]}
              value={draft.password}
              onChangeText={(password) => update({ password })}
              placeholder="Passwort (falls nötig)"
              placeholderTextColor={theme.secondary}
              secureTextEntry
            />
          </Card>
          <Button
            title="Verbinden"
            style={styles.action}
            disabled={!normalizeLocalAddress(draft.localAddress)}
            onPress={async () => {
              await persist();
              onDone();
              await connectLocal(draft);
            }}
          />
        </>
      ) : (
        <Button
          title="Bei remote.keba.com anmelden"
          style={styles.action}
          onPress={async () => {
            await persist();
            onDone();
            startRemoteLogin();
          }}
        />
      )}

      {phase !== 'notConnected' && (
        <Button title="Verbindung trennen" kind="danger" style={styles.action} onPress={disconnect} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 13, marginTop: 8, marginHorizontal: 4 },
  form: { paddingVertical: 0 },
  input: { fontSize: 17, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  action: { marginTop: 20 },
});
