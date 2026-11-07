import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Button, Card, Chips, IconBadge, Row, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { expenseVat, periods, useBooks } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { peso, shortDate, todayIso } from '@/utils/money';

export default function ExpensesScreen() {
  const t = useTheme();
  const router = useRouter();
  const books = useBooks();
  const options = useMemo(() => periods(todayIso()), []);
  const [periodKey, setPeriodKey] = useState('month');
  const period = options.find((p) => p.key === periodKey) ?? options[0];

  const list = books.expenses
    .filter((e) => e.date >= period.from && e.date <= period.to)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = list.reduce((s, e) => s + e.amount, 0);
  const vat = list.reduce((s, e) => s + expenseVat(e), 0);

  return (
    <Screen title="Expenses">
      <Button
        label="Snap a receipt"
        icon={<Icon ios="camera.fill" md="photo_camera" size={20} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
        onPress={() => router.push('/expense/new')}
      />

      <Chips options={options} value={periodKey} onChange={setPeriodKey} />

      <Card>
        <View style={styles.totals}>
          <View style={{ flex: 1 }}>
            <Txt variant="label">Total spent</Txt>
            <Txt variant="title" style={{ fontVariant: ['tabular-nums'] }}>
              {peso(total)}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt variant="label">Input VAT</Txt>
            <Txt variant="figure" style={{ color: t.accent }}>
              {peso(vat)}
            </Txt>
          </View>
        </View>
      </Card>

      <SectionHeader title={`${list.length} record${list.length === 1 ? '' : 's'}`} />
      {list.length === 0 ? (
        <Card>
          <Txt variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            No expenses in {period.label.toLowerCase()}. Snap a receipt to add one.
          </Txt>
        </Card>
      ) : (
        <Card padded={false}>
          {list.map((e, i) => (
            <Row
              key={e.id}
              last={i === list.length - 1}
              leading={
                e.receiptUri ? (
                  <Image source={{ uri: e.receiptUri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <IconBadge>
                    <Icon ios="receipt" md="receipt_long" size={18} color={t.accent} />
                  </IconBadge>
                )
              }
              title={e.supplier}
              subtitle={`${e.category} · ${shortDate(e.date)}${e.vatable ? ' · VAT' : ''}`}
              trailing={<Txt variant="figure">{peso(e.amount)}</Txt>}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  thumb: { width: 38, height: 38, borderRadius: 10 },
});
