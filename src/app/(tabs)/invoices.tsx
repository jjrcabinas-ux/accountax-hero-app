import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { invoiceBalance, isOverdue, statusOf } from '@/books/invoices';
import { canRead, canWrite } from '@/books/sync';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Button, Card, Chips, Pill, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { invoiceStatus, invoiceTotal, liveInvoices, useBooksVersion } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { peso, shortDate, todayIso } from '@/utils/money';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

export default function InvoicesScreen() {
  const t = useTheme();
  const router = useRouter();
  const v = useBooksVersion();
  const today = todayIso();
  const [filter, setFilter] = useState<Filter>('all');

  const { all, unpaid, overdue } = useMemo(() => {
    const list = liveInvoices();
    const open = list.filter((i) => invoiceBalance(i) > 0.005);
    return {
      all: list,
      unpaid: open.reduce((s, i) => s + invoiceBalance(i), 0),
      overdue: open.filter((i) => isOverdue(i, today)).reduce((s, i) => s + invoiceBalance(i), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, today]);

  const list =
    filter === 'all'
      ? all
      : filter === 'paid'
        ? all.filter((i) => statusOf(i) === 'paid')
        : filter === 'overdue'
          ? all.filter((i) => isOverdue(i, today))
          : all.filter((i) => statusOf(i) !== 'paid');

  if (!canRead('invoices')) {
    return (
      <Screen title="Invoices">
        <Card>
          <Txt variant="body" color="textSecondary">Invoices aren’t part of your role in this business.</Txt>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Invoices">
      {canWrite('invoices') ? (
        <Button
          label="New invoice"
          icon={<Icon ios="plus" md="add" size={20} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
          onPress={() => router.push('/invoice/new')}
        />
      ) : null}

      <View style={styles.tiles}>
        <Card style={{ flex: 1 }}>
          <Txt variant="label">Unpaid</Txt>
          <Txt variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
            {peso(unpaid, { decimals: false })}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="label">Overdue</Txt>
          <Txt variant="heading" style={{ color: overdue > 0 ? t.negative : t.text, fontVariant: ['tabular-nums'] }}>
            {peso(overdue, { decimals: false })}
          </Txt>
        </Card>
      </View>

      <Chips options={FILTERS} value={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <Card>
          <Txt variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            {filter === 'all' ? 'No invoices yet.' : `No ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} invoices.`}
          </Txt>
        </Card>
      ) : (
        <Card padded={false}>
          {list.map((i, idx) => {
            const st = invoiceStatus(i, today);
            return (
              <Row
                key={i.id}
                last={idx === list.length - 1}
                onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: i.id } })}
                title={i.customerName || 'No customer'}
                subtitle={`${i.number} · due ${shortDate(i.dueDate)}`}
                trailing={
                  <View style={styles.trailing}>
                    <Txt variant="figure">{peso(invoiceTotal(i))}</Txt>
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
  tiles: { flexDirection: 'row', gap: Spacing.three },
  trailing: { alignItems: 'flex-end', gap: 4 },
});
