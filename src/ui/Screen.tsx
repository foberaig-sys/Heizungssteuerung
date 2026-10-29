import { ReactNode, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LargeTitle } from './components';
import { Icon, icons } from './Icon';
import { useTabBarInset } from './TabBar';
import { type, useTheme } from './theme';

/**
 * Seite eines Tabs: große Überschrift, Inhalt läuft unter der schwebenden Leiste durch.
 * Mit `onBack` wird daraus eine Unterseite mit Zurück-Knopf und kleinem Titel.
 */
export function Screen({
  title,
  children,
  onRefresh,
  onBack,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  onBack?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {onBack && (
        <View style={[styles.navBar, { paddingTop: insets.top + 4, backgroundColor: theme.background }]}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}
          >
            <Icon icon={icons.back} size={20} color={theme.accent} />
            <Text style={[type.body, { color: theme.accent }]}>Zurück</Text>
          </Pressable>
          <Text style={[type.headline, styles.navTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.back} />
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: onBack ? 8 : insets.top + 8, paddingBottom: bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        scrollIndicatorInsets={{ bottom }}
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
        {!onBack && <LargeTitle>{title}</LargeTitle>}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 96 },
  navTitle: { flex: 1, textAlign: 'center' },
});
