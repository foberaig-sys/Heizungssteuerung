import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** modbus: direkt im Heimnetz ohne Passwort (eigene App-Version nötig); remote: über remote.keba.com; local: Web-HMI im Heimnetz. */
export type ConnectionMode = 'modbus' | 'remote' | 'local';

export interface Settings {
  mode: ConnectionMode;
  /** IP-Adresse der Wärmepumpe für Modbus TCP (Port 502). */
  modbusAddress: string;
  /** Namen der Heizkreise, kommagetrennt – Modbus liefert keine Namen. Die Anzahl legt die Heizkreise fest. */
  circuitNames: string;
  /** Zugang zu remote.keba.com – damit meldet sich die App unsichtbar selbst an. */
  portalUsername: string;
  portalPassword: string;
  /** Textstück des Geräteeintrags im Portal. */
  portalDevice: string;
  /** IP-Adresse oder Hostname des Reglers im Heimnetz. */
  localAddress: string;
  username: string;
  password: string;
}

export const defaultSettings: Settings = {
  mode: 'modbus',
  modbusAddress: '192.168.0.100',
  circuitNames: 'Puffer FBH, Heizkörper',
  portalUsername: '',
  portalPassword: '',
  portalDevice: 'WebHmi',
  localAddress: '',
  username: '',
  password: '',
};

export function circuitNameList(s: Settings): string[] {
  const names = s.circuitNames.split(',').map((n) => n.trim()).filter(Boolean).slice(0, 8);
  return names.length > 0 ? names : ['Heizkreis 1'];
}

export const hasPortalCredentials = (s: Settings) => s.portalUsername.trim() !== '' && s.portalPassword !== '';

/** Reicht das Eingetragene, um ohne Rückfrage zu verbinden? */
export function isConfigured(s: Settings): boolean {
  switch (s.mode) {
    case 'modbus':
      return s.modbusAddress.trim() !== '';
    case 'remote':
      return hasPortalCredentials(s);
    case 'local':
      return s.localAddress.trim() !== '';
  }
}

const KEY = 'heizung.settings';
// Passwörter liegen im iOS-Schlüsselbund, nicht im normalen App-Speicher.
const SECRET_KEYS = { password: 'heizung.password', portalPassword: 'heizung.portalPassword' } as const;

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const password = (await SecureStore.getItemAsync(SECRET_KEYS.password)) ?? '';
    const portalPassword = (await SecureStore.getItemAsync(SECRET_KEYS.portalPassword)) ?? '';
    return { ...defaultSettings, ...stored, password, portalPassword };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { password, portalPassword, ...rest } = settings;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    for (const [field, key] of Object.entries(SECRET_KEYS) as [keyof typeof SECRET_KEYS, string][]) {
      const value = field === 'password' ? password : portalPassword;
      if (value) await SecureStore.setItemAsync(key, value);
      else await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Speichern ist Komfort; die Verbindung soll daran nicht scheitern (z. B. SecureStore im Browser).
  }
}
