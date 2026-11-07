import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { balanceSheet, incomeStatement } from '@/books/statements';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Card, Chips } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { AGING_BUCKETS, arAging, business, periods, useBooksVersion } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { longDate, peso, todayIso } from '@/utils/money';

const TITLES: Record<string, string> = { pl: 'Profit and loss', bs: 'Balance sheet', ar: 'AR aging' };
type Line = { id: string; label: string; amount: number };

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useBooksVersion();
  const biz = business();
  return (
    <Sheet>
      <Stack.Screen options={{ title: TITLES[id] ?? 'Report' }} />
      <View>
        <Txt variant="heading">{biz.name}</Txt>
        {biz.tin ? <Txt variant="caption">TIN {biz.tin}</Txt> : null}
      </View>
      {id === 'pl' ? <ProfitAndLoss /> : id === 'bs' ? <BalanceSheet /> : id === 'ar' ? <Aging /> : <Txt variant="body">Unknown report.</Txt>}
    </Sheet>
  );
}

function Section({ title, lines, total, totalLabel }: { title: string; lines: Line[]; total: number; totalLabel: string }) {
  return (
    <Card>
      <Txt variant="label">{title}</Txt>
      {lines.length === 0 ? <Txt variant="caption">None</Txt> : null}
      {lines.map((r) => (
        <AmountLine key={r.id} label={r.label} value={peso(r.amount)} indent />
      ))}
      <AmountLine label={totalLabel} value={peso(total)} strong />
    </Card>
  );
}

function ProfitAndLoss() {
  const t = useTheme();
  const v = useBooksVersion();
  const options = useMemo(() => periods(todayIso()), []);
  const [key, setKey] = useState('quarter');
  const p = options.find((o) => o.key === key) ?? options[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const is = useMemo(() => incomeStatement(p.from, p.to), [v, p.from, p.to]);
  const expenses = is.totalOpex;
  return (
    <>
      <Chips options={options} value={key} onChange={setKey} />
      <Txt variant="caption">
        {longDate(p.from)} – {longDate(p.to)}
      </Txt>
      <Section title="Revenue" lines={is.lines.revenue} total={is.totalRevenue} totalLabel="Total revenue" />
      {is.totalCOS ? <Section title="Cost of sales" lines={is.lines.cos} total={is.totalCOS} totalLabel="Total cost of sales" /> : null}
      {is.totalCOS ? (
        <Card>
          <AmountLine label="Gross profit" value={peso(is.grossProfit)} strong />
        </Card>
      ) : null}
      {is.lines.otherOperatingIncome.length ? (
        <Section title="Other income" lines={is.lines.otherOperatingIncome} total={is.otherOperatingIncome} totalLabel="Total other income" />
      ) : null}
      <Section title="Operating expenses" lines={is.lines.operatingExpenses} total={is.distributionCosts + is.adminExpenses + is.otherOpex} totalLabel="Total operating expenses" />
      {is.financeCosts || is.financeIncome || is.incomeTax ? (
        <Card>
          {is.financeIncome ? <AmountLine label="Finance income" value={peso(is.financeIncome)} /> : null}
          {is.financeCosts ? <AmountLine label="Finance costs" value={peso(-is.financeCosts)} /> : null}
          <AmountLine label="Profit before tax" value={peso(is.profitBeforeTax)} strong />
          {is.incomeTax ? <AmountLine label="Income tax" value={peso(-is.incomeTax)} /> : null}
        </Card>
      ) : null}
      <Card>
        <View style={styles.bottomLine}>
          <Txt variant="heading">{is.netIncome < 0 ? 'Net loss' : 'Net income'}</Txt>
          <Txt variant="heading" style={{ color: is.netIncome < 0 ? t.negative : t.positive, fontVariant: ['tabular-nums'] }}>
            {peso(is.netIncome)}
          </Txt>
        </View>
        <Txt variant="caption" style={{ marginTop: 4 }}>
          Total expenses incl. cost of sales: {peso(is.totalCOS + expenses)}
        </Txt>
      </Card>
    </>
  );
}

function BalanceSheet() {
  const t = useTheme();
  const v = useBooksVersion();
  const today = todayIso();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bs = useMemo(() => balanceSheet(today), [v, today]);
  return (
    <>
      <Txt variant="caption">As of {longDate(today)}</Txt>
      <Section title="Current assets" lines={bs.currentAssets} total={bs.totalCurrentAssets} totalLabel="Total current assets" />
      {bs.nonCurrentAssets.length ? <Section title="Non-current assets" lines={bs.nonCurrentAssets} total={bs.totalNonCurrentAssets} totalLabel="Total non-current assets" /> : null}
      <Card>
        <AmountLine label="Total assets" value={peso(bs.totalAssets)} strong />
      </Card>
      <Section title="Current liabilities" lines={bs.currentLiab} total={bs.totalCurrentLiab} totalLabel="Total current liabilities" />
      {bs.nonCurrentLiab.length ? <Section title="Non-current liabilities" lines={bs.nonCurrentLiab} total={bs.totalNonCurrentLiab} totalLabel="Total non-current liabilities" /> : null}
      <Section title="Equity" lines={bs.equity} total={bs.totalEquity} totalLabel="Total equity" />
      <Card>
        <AmountLine label="Total liabilities and equity" value={peso(bs.totalLiabAndEquity)} strong />
      </Card>
      <Txt variant="caption" style={{ color: bs.balanced ? t.positive : t.negative }}>
        {bs.balanced ? 'Balanced — assets equal liabilities plus equity.' : 'Out of balance — check the books in the web app.'}
      </Txt>
    </>
  );
}

function Aging() {
  const t = useTheme();
  const v = useBooksVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aging = useMemo(() => arAging(), [v]);
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
      {aging.customers.length === 0 ? (
        <Txt variant="body" color="textSecondary">No unpaid invoices.</Txt>
      ) : (
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
                  {c.buckets.map((val, i) => (
                    <Txt key={i} variant="caption" color={val ? 'text' : 'textSecondary'} style={[styles.num, { width: colW }]}>
                      {val ? peso(val, { decimals: false }) : '—'}
                    </Txt>
                  ))}
                  <Txt variant="figure" style={[styles.num, { width: colW + 12 }]}>{peso(c.total, { decimals: false })}</Txt>
                </View>
              ))}
              <View style={styles.tr}>
                <Txt variant="bodyStrong" style={styles.nameCol}>Total</Txt>
                {aging.totals.map((val, i) => (
                  <Txt key={i} variant="figure" style={[styles.num, { width: colW, fontSize: 13 }]}>
                    {val ? peso(val, { decimals: false }) : '—'}
                  </Txt>
                ))}
                <Txt variant="figure" style={[styles.num, { width: colW + 12 }]}>{peso(aging.grandTotal, { decimals: false })}</Txt>
              </View>
            </View>
          </ScrollView>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bottomLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  nameCol: { width: 150, paddingRight: Spacing.two },
  num: { textAlign: 'right', fontVariant: ['tabular-nums'] },
});
