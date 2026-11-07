import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import type { AndroidSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { Txt } from './txt';

const TABS: { name: string; href: '/' | '/expenses' | '/invoices' | '/reports'; label: string; md: AndroidSymbol }[] = [
  { name: 'index', href: '/', label: 'Home', md: 'home' },
  { name: 'expenses', href: '/expenses', label: 'Expenses', md: 'receipt_long' },
  { name: 'invoices', href: '/invoices', label: 'Invoices', md: 'request_quote' },
  { name: 'reports', href: '/reports', label: 'Reports', md: 'bar_chart' },
];

/** Web: a bottom tab bar that mirrors the native one, so the preview matches the phone. */
export default function AppTabs() {
  const t = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { backgroundColor: t.surface, borderTopColor: t.border }])}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton md={tab.md}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, md, ...props }: TabTriggerSlotProps & { md: AndroidSymbol }) {
  const t = useTheme();
  const color = isFocused ? t.accent : t.textSecondary;
  return (
    <Pressable {...(props as PressableProps)} style={styles.tab}>
      <View style={[styles.indicator, isFocused && { backgroundColor: t.backgroundSelected }]}>
        <Icon ios="circle" md={md} size={22} color={color} />
      </View>
      <Txt variant="caption" style={{ color, fontWeight: isFocused ? '600' : '500' }}>
        {children}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  indicator: { paddingHorizontal: 18, paddingVertical: 3, borderRadius: Radius.pill },
});
