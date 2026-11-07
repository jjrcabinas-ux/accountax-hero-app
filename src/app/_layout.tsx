import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme, View } from 'react-native';

import { Brand, Colors } from '@/constants/theme';
import { useSession } from '@/lib/session';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];
  const session = useSession();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, border: c.border, text: c.text },
  };

  if (session.status === 'starting') return <View style={{ flex: 1, backgroundColor: Brand.navy }} />;
  const signedIn = session.status !== 'signedOut';

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerTintColor: scheme === 'dark' ? Brand.emerald : Brand.emeraldDeep }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
          <Stack.Screen name="expense/new" options={{ presentation: 'modal', title: 'Record expense' }} />
          <Stack.Screen name="invoice/new" options={{ presentation: 'modal', title: 'New invoice' }} />
          <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
          <Stack.Screen name="report/[id]" options={{ title: 'Report' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
