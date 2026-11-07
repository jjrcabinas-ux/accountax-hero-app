import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { expenseTotals } from '@/books/expenses';
import { canRead, canWrite } from '@/books/sync';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Button, Card, Chips, IconBadge, Pill, Row, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { expenseStatusLabel, liveExpenses, periods, useBooksVersion } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { peso, shortDate, todayIso } from '@/utils/money';

export default function ExpensesScreen() {
  const t = useTheme();
  const router = useRouter();
  const v = useBooksVersion();
  const options = useMemo(() => periods(todayIso()), []);
  const [periodKey, setPeriodKey] = useState('month');
  const period = options.find((p) => p.key === periodKey) ?? options[0];

  const { list, total, vat } = useMemo(() => {
    const l = liveExpenses().filter((e) => e.date >= period.from && e.date <= period.to);
    const sums = l.map((e) => expenseTotals(e));
    return { list: l, total: sums.reduce((s, x) => s + x.total, 0), vat: sums.reduce((s, x) => s + x.vat, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, period.from, period.to]);

  if (!canRead('expenses')) {
    return (
      <Screen title="Expenses">
        <Card>
          <Txt variant="body" color="textSecondary">Expenses aren’t part of your role in this business.</Txt>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Expenses">
      {canWrite('expenses') ? (
        <Button
          label="Snap a receipt"
          icon={<Icon ios="camera.fill" md="photo_camera" size={20} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
          onPress={() => router.push('/expense/new')}
        />
      ) : null}

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
            No expenses in {period.label.toLowerCase()}.
          </Txt>
        </Card>
      ) : (
        <Card padded={false}>
          {list.map((e, i) => {
            const st = expenseStatusLabel(e);
            return (
              <Row
                key={e.id}
                last={i === list.length - 1}
                leading={
                  <IconBadge>
                    <Icon ios="receipt" md="receipt_long" size={18} color={t.accent} />
                  </IconBadge>
                }
                title={e.supplierName || 'No supplier'}
                subtitle={`${e.number} · ${e.lines[0]?.accountName ?? ''} · ${shortDate(e.date)}`}
                trailing={
                  <View style={styles.trailing}>
                    <Txt variant="figure">{peso(expenseTotals(e).total)}</Txt>
                    <Pill label={st.label} tone={st.tone} />
                  </View>
                }
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
