import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Card, Chips } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { business } from '@/data/sample';
import { AGING_BUCKETS, arAging, balanceSheet, periods, profitAndLoss, useBooks } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { longDate, peso, todayIso } from '@/utils/money';

const TITLES: Record<string, string> = { pl: 'Profit and loss', bs: 'Balance sheet', ar: 'AR aging' };

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Sheet>
      <Stack.Screen options={{ title: TITLES[id] ?? 'Report' }} />
      <View>
        <Txt variant="heading">{business.name}</Txt>
        <Txt variant="caption">TIN {business.tin}</Txt>
      </View>
      {id === 'pl' ? <ProfitAndLoss /> : id === 'bs' ? <BalanceSheet /> : id === 'ar' ? <Aging /> : (
        <Txt variant="body">Unknown report.</Txt>
      )}
    </Sheet>
  );
}

function ProfitAndLoss() {
  const t = useTheme();
  const books = useBooks();
  const options = useMemo(() => periods(todayIso()), []);
  const [key, setKey] = useState('quarter');
  const p = options.find((o) => o.key === key) ?? options[0];
  const pl = profitAndLoss(books, p);
  return (
    <>
      <Chips options={options} value={key} onChange={setKey} />
      <Txt variant="caption">
        {longDate(p.from)} – {longDate(p.to)} · amounts net of VAT
      </Txt>
      <Card>
        <Txt variant="label">Revenue</Txt>
        {pl.revenue.map((r) => (
          <AmountLine key={r.label} label={r.label} value={peso(r.amount)} indent />
        ))}
        <AmountLine label="Total revenue" value={peso(pl.totalRevenue)} strong />
      </Card>
      <Card>
        <Txt variant="label">Operating expenses</Txt>
        {pl.expenses.length === 0 ? <Txt variant="caption">None in this period</Txt> : null}
        {pl.expenses.map((r) => (
          <AmountLine key={r.label} label={r.label} value={peso(r.amount)} indent />
        ))}
        <AmountLine label="Total expenses" value={peso(pl.totalExpenses)} strong />
      </Card>
      <Card>
        <View style={styles.bottomLine}>
          <Txt variant="heading">{pl.netIncome < 0 ? 'Net loss' : 'Net income'}</Txt>
          <Txt variant="heading" style={{ color: pl.netIncome < 0 ? t.negative : t.positive, fontVariant: ['tabular-nums'] }}>
            {peso(pl.netIncome)}
          </Txt>
        </View>
      </Card>
    </>
  );
}

function BalanceSheet() {
  const t = useTheme();
  const bs = balanceSheet(useBooks());
  const balanced = Math.abs(bs.totalAssets - bs.totalLiabilities - bs.totalEquity) < 0.01;
  return (
    <>
      <Txt variant="caption">As of {longDate(todayIso())}</Txt>
      <Card>
        <Txt variant="label">Assets</Txt>
        {bs.assets.map((r) => (
          <AmountLine key={r.label} label={r.label} value={peso(r.amount)} indent />
        ))}
        <AmountLine label="Total assets" value={peso(bs.totalAssets)} strong />
      </Card>
      <Card>
        <Txt variant="label">Liabilities</Txt>
        {bs.liabilities.map((r) => (
          <AmountLine key={r.label} label={r.label} value={peso(r.amount)} indent />
        ))}
        <AmountLine label="Total liabilities" value={peso(bs.totalLiabilities)} strong />
        <View style={{ height: Spacing.three }} />
        <Txt variant="label">Equity</Txt>
        {bs.equity.map((r) => (
          <AmountLine key={r.label} label={r.label} value={peso(r.amount)} indent />
        ))}
        <AmountLine label="Total equity" value={peso(bs.totalEquity)} strong />
        <View style={[styles.rule, { backgroundColor: t.border }]} />
        <AmountLine label="Total liabilities and equity" value={peso(bs.totalLiabilities + bs.totalEquity)} strong />
      </Card>
      <Txt variant="caption" style={{ color: balanced ? t.positive : t.negative }}>
        {balanced ? 'Balanced — assets equal liabilities plus equity.' : 'Out of balance — check the books.'}
      </Txt>
    </>
  );
}

function Aging() {
  const t = useTheme();
  const aging = arAging(useBooks());
  const colW = 92;
  return (
    <>
      <Txt variant="caption">As of {longDate(todayIso())} · days past due date</Txt>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {AGING_BUCKETS.map((b, i) => (
          <View key={b} style={{ alignItems: 'center', flex: 1 }}>
            <Txt variant="caption">{b}</Txt>
            <Txt variant="caption" style={{ fontWeight: '700', color: i >= 2 && aging.totals[i] > 0 ? t.negative : t.text }}>
              {aging.totals[i] ? `${Math.round(aging.totals[i] / 1000)}K` : '—'}
            </Txt>
          </View>
        ))}
      </Card>
      <Card padded={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.tr, { borderBottomColor: t.border }]}>
              <Txt variant="label" style={styles.nameCol}>Customer</Txt>
              {AGING_BUCKETS.map((b) => (
                <Txt key={b} variant="label" style={[styles.num, { width: colW }]}>{b}</Txt>
              ))}
              <Txt variant="label" style={[styles.num, { width: colW + 12 }]}>Total</Txt>
            </View>
            {aging.customers.map((c) => (
              <View key={c.name} style={[styles.tr, { borderBottomColor: t.border }]}>
                <Txt variant="body" style={styles.nameCol} numberOfLines={2}>{c.name}</Txt>
                {c.buckets.map((v, i) => (
                  <Txt key={i} variant="caption" color={v ? 'text' : 'textSecondary'} style={[styles.num, { width: colW }]}>
                    {v ? peso(v, { decimals: false }) : '—'}
                  </Txt>
                ))}
                <Txt variant="figure" style={[styles.num, { width: colW + 12 }]}>{peso(c.total, { decimals: false })}</Txt>
              </View>
            ))}
            <View style={styles.tr}>
              <Txt variant="bodyStrong" style={styles.nameCol}>Total</Txt>
              {aging.totals.map((v, i) => (
                <Txt key={i} variant="figure" style={[styles.num, { width: colW, fontSize: 13 }]}>
                  {v ? peso(v, { decimals: false }) : '—'}
                </Txt>
              ))}
              <Txt variant="figure" style={[styles.num, { width: colW + 12 }]}>{peso(aging.grandTotal, { decimals: false })}</Txt>
            </View>
          </View>
        </ScrollView>
      </Card>
      {aging.customers.length === 0 ? <Txt variant="body" color="textSecondary">No unpaid invoices. Nice.</Txt> : null}
    </>
  );
}

const styles = StyleSheet.create({
  bottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameCol: { width: 150, paddingRight: Spacing.two },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
