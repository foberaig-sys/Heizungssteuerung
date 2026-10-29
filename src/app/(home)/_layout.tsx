import { Stack } from 'expo-router';

import { useTheme } from '../../ui/theme';

/** Startseite mit Unterseiten – native Navigation inkl. Zurück-Wischgeste. */
export default function HomeLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.accent,
        headerTransparent: true,
        headerBlurEffect: 'systemChromeMaterial',
        headerBackTitle: 'Start',
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Start' }} />
    </Stack>
  );
}
