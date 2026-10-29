import { useRouter } from 'expo-router';

import { SettingsScreen } from '../screens/SettingsScreen';
import { useSettings } from '../settingsContext';

export default function SettingsRoute() {
  const { settings, setSettings } = useSettings();
  const router = useRouter();
  return <SettingsScreen settings={settings} onChange={setSettings} onDone={() => router.navigate('/')} />;
}
