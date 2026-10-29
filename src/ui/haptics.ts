// Haptik nur für Momente, die zählen: Wert verstellt, Auswahl getroffen, gespeichert, Fehler.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safely(run: () => Promise<void>) {
  if (!enabled) return;
  run().catch(() => undefined);
}

export const haptic = {
  /** Pfeiltaste, Stepper. */
  tap: () => safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Auswahl einer Betriebsart. */
  select: () => safely(() => Haptics.selectionAsync()),
  success: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
