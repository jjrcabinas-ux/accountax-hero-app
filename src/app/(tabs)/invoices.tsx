import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Button, Card, Chips, Pill, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { invoiceStatus, invoiceTotal, STATUS_TONE, useBooks } from '@/data/store';
import type { InvoiceStatus } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { peso, shortDate, todayIso } from '@/utils/money';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Unpaid', label: 'Unpaid' },
  { key: 'Overdue', label: 'Overdue' },
  { key: 'Paid', label: 'Paid' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

export default function InvoicesScreen() {
  const t = useTheme();
  const router = useRouter();
  const books = useBooks();
  const today = todayIso();
  const [filter, setFilter] = useState<Filter>('all');

  const withStatus = books.invoices
    .map((i) => ({ ...i, status: invoiceStatus(i, today), total: invoiceTotal(i) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const list = filter === 'all' ? withStatus : withStatus.filter((i) => i.status === filter);
  const sum = (s: InvoiceStatus) => withStatus.filter((i) => i.status === s).reduce((a, i) => a + i.total, 0);

  return (
    <Screen title="Invoices">
      <Button
        label="New invoice"
        icon={<Icon ios="plus" md="add" size={20} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
        onPress={() => router.push('/invoice/new')}
      />

      <View style={styles.tiles}>
        <Card style={{ flex: 1 }}>
          <Txt variant="label">Unpaid</Txt>
          <Txt variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
            {peso(sum('Unpaid'), { decimals: false })}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="label">Overdue</Txt>
          <Txt variant="heading" style={{ color: t.negative, fontVariant: ['tabular-nums'] }}>
            {peso(sum('Overdue'), { decimals: false })}
          </Txt>
        </Card>
      </View>

      <Chips options={FILTERS} value={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <Card>
          <Txt variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            No {filter.toLowerCase()} invoices.
          </Txt>
        </Card>
      ) : (
        <Card padded={false}>
          {list.map((i, idx) => (
            <Row
              key={i.id}
              last={idx === list.length - 1}
              onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: i.id } })}
              title={i.customer}
              subtitle={`${i.number} · due ${shortDate(i.dueDate)}`}
              trailing={
                <View style={styles.trailing}>
                  <Txt variant="figure">{peso(i.total)}</Txt>
                  <Pill label={i.status} tone={STATUS_TONE[i.status]} />
                </View>
              }
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: Spacing.three },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
