import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type ConnectionMode = 'remote' | 'local';

export interface Settings {
  mode: ConnectionMode;
  /** IP-Adresse oder Hostname des Reglers im Heimnetz. */
  localAddress: string;
  username: string;
  password: string;
}

export const defaultSettings: Settings = { mode: 'remote', localAddress: '', username: '', password: '' };

const KEY = 'heizung.settings';
const PASSWORD_KEY = 'heizung.password';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const password = (await SecureStore.getItemAsync(PASSWORD_KEY)) ?? '';
    return { ...defaultSettings, ...stored, password };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { password, ...rest } = settings;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    if (password) {
      await SecureStore.setItemAsync(PASSWORD_KEY, password);
    } else {
      await SecureStore.deleteItemAsync(PASSWORD_KEY);
    }
  } catch {
    // Speichern ist Komfort; die Verbindung soll daran nicht scheitern (z. B. SecureStore im Browser).
  }
}
