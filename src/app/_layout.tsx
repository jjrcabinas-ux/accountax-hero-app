import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Brand, Colors } from '@/constants/theme';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, border: c.border, text: c.text },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerTintColor: scheme === 'dark' ? Brand.emerald : Brand.emeraldDeep }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen name="expense/new" options={{ presentation: 'modal', title: 'Record expense' }} />
        <Stack.Screen name="invoice/new" options={{ presentation: 'modal', title: 'New invoice' }} />
        <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Report' }} />
      </Stack>
    </ThemeProvider>
  );
}
