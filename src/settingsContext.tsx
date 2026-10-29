import { ReactNode, createContext, useContext, useState } from 'react';

import { Settings, defaultSettings } from './settings';

interface SettingsContextValue {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Die gespeicherten Einstellungen – geladen im Root-Layout, bearbeitet im Tab „Einstellungen“. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings außerhalb von <SettingsProvider>');
  return value;
}
