import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { Txt } from '@/components/txt';
import { BrandMark, Button } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { signOut, useSession } from '@/lib/session';

/** The tabs open once the books have loaded; until then a loading or "can't open" screen. */
export default function TabsLayout() {
  const s = useSession();
  if (s.status === 'ready') return <AppTabs />;
  return (
    <View style={styles.gate}>
      <BrandMark size={56} />
      {s.status === 'blocked' ? (
        <>
          <Txt variant="body" style={styles.msg}>
            {s.message}
          </Txt>
          <Button label="Sign out" kind="secondary" onPress={() => void signOut()} />
        </>
      ) : (
        <>
          <ActivityIndicator color={Brand.emerald} />
          <Txt variant="body" style={styles.msg}>
            Opening your books…
          </Txt>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, backgroundColor: Brand.navy, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  msg: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 420 },
});
