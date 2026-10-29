import { ReactNode, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LargeTitle } from './components';
import { useTheme } from './theme';

/**
 * Seite eines Tabs mit großer Überschrift. Die echte Tab-Leiste und – auf Unterseiten – die native
 * Navigationsleiste schweben darüber; iOS rückt den Inhalt dafür selbst ein (contentInsetAdjustment).
 */
export function Screen({
  title,
  children,
  onRefresh,
  largeTitle = true,
  accessory,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  /** false auf Unterseiten: dort steht der Titel in der nativen Navigationsleiste. */
  largeTitle?: boolean;
  /** Optionaler Inhalt über der Überschrift, z. B. das Logo. */
  accessory?: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Android rückt nicht automatisch ein → Abstand selbst setzen.
  const manual = Platform.OS !== 'ios';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingTop: manual && (largeTitle || accessory) ? insets.top + 8 : 8, paddingBottom: manual ? insets.bottom + 96 : 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.accent}
              onRefresh={async () => {
                setRefreshing(true);
                await onRefresh();
                setRefreshing(false);
              }}
            />
          ) : undefined
        }
      >
        {accessory}
        {largeTitle && <LargeTitle>{title}</LargeTitle>}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
});
