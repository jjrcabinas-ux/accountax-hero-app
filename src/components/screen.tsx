import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { business } from '@/data/sample';
import { useTheme } from '@/hooks/use-theme';

import { Txt } from './txt';
import { BrandMark } from './ui';

/** Tab screen shell: brand bar, large title, scrolling content column. */
export function Screen({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + BottomTabInset + Spacing.five },
      ]}>
      <View style={styles.column}>
        <View style={styles.brandBar}>
          <BrandMark size={28} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              AccounTax<Txt variant="bodyStrong" style={{ color: t.accent }}> Hero</Txt>
            </Txt>
            <Txt variant="caption" numberOfLines={1}>
              {business.name}
            </Txt>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Txt variant="title" accessibilityRole="header">
            {title}
          </Txt>
          {action}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

/** Scroll container for pushed/modal screens that already have a native header. */
export function Sheet({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, { paddingTop: Spacing.three, paddingBottom: insets.bottom + Spacing.five }]}>
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.three, alignItems: 'center' },
  column: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  brandBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two },
});
