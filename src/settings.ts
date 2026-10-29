import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** modbus: direkt im Heimnetz ohne Passwort (eigene App-Version nötig); remote: über remote.keba.com. */
export type ConnectionMode = 'modbus' | 'remote';

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
}

export const defaultSettings: Settings = {
  mode: 'modbus',
  modbusAddress: '192.168.0.100',
  circuitNames: 'Puffer FBH, Heizkörper',
  portalUsername: '',
  portalPassword: '',
  portalDevice: 'WebHmi',
};

export function circuitNameList(s: Settings): string[] {
  const names = s.circuitNames.split(',').map((n) => n.trim()).filter(Boolean).slice(0, 8);
  return names.length > 0 ? names : ['Heizkreis 1'];
}

export const hasPortalCredentials = (s: Settings) => s.portalUsername.trim() !== '' && s.portalPassword !== '';

/** Reicht das Eingetragene, um ohne Rückfrage zu verbinden? */
export function isConfigured(s: Settings): boolean {
  return s.mode === 'modbus' ? s.modbusAddress.trim() !== '' : hasPortalCredentials(s);
}

const KEY = 'heizung.settings';
// Passwort liegt im iOS-Schlüsselbund, nicht im normalen App-Speicher.
const PORTAL_PASSWORD_KEY = 'heizung.portalPassword';
/** Stammt aus der entfernten Web-HMI-Verbindung; wird beim Speichern aufgeräumt. */
const LEGACY_PASSWORD_KEY = 'heizung.password';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Settings> & { mode?: string }) : {};
    const portalPassword = (await SecureStore.getItemAsync(PORTAL_PASSWORD_KEY)) ?? '';
    // Frühere Version hatte zusätzlich „Web-HMI“ – das wird zu Modbus.
    const mode: ConnectionMode = stored.mode === 'remote' ? 'remote' : 'modbus';
    return {
      mode,
      modbusAddress: stored.modbusAddress ?? defaultSettings.modbusAddress,
      circuitNames: stored.circuitNames ?? defaultSettings.circuitNames,
      portalUsername: stored.portalUsername ?? defaultSettings.portalUsername,
      portalDevice: stored.portalDevice ?? defaultSettings.portalDevice,
      portalPassword,
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { portalPassword, ...rest } = settings;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
    if (portalPassword) await SecureStore.setItemAsync(PORTAL_PASSWORD_KEY, portalPassword);
    else await SecureStore.deleteItemAsync(PORTAL_PASSWORD_KEY);
    await SecureStore.deleteItemAsync(LEGACY_PASSWORD_KEY);
  } catch {
    // Speichern ist Komfort; die Verbindung soll daran nicht scheitern (z. B. SecureStore im Browser).
  }
}
