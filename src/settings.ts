import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type ConnectionMode = 'remote' | 'local';

export interface Settings {
  mode: ConnectionMode;
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
  mode: 'remote',
  portalUsername: '',
  portalPassword: '',
  portalDevice: 'WebHmi',
  localAddress: '',
  username: '',
  password: '',
};

export const hasPortalCredentials = (s: Settings) => s.portalUsername.trim() !== '' && s.portalPassword !== '';

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
