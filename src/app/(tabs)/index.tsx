import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Card, Chips, IconBadge, Pill, Row, SectionHeader } from '@/components/ui';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { deadlines } from '@/data/sample';
import {
  cashOnHand,
  invoiceStatus,
  invoiceTotal,
  periods,
  receivables,
  summary,
  useBooks,
} from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { daysBetween, peso, pesoShort, shortDate, todayIso } from '@/utils/money';

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const books = useBooks();
  const today = todayIso();
  const options = useMemo(() => periods(today), [today]);
  const [periodKey, setPeriodKey] = useState('month');
  const period = options.find((p) => p.key === periodKey) ?? options[0];

  const s = summary(books, period);
  const cash = cashOnHand(books);
  const ar = receivables(books);
  const overdue = books.invoices.filter((i) => invoiceStatus(i, today) === 'Overdue');
  const upcoming = deadlines.filter((d) => d.due >= today).slice(0, 3);

  const activity = [
    ...books.invoices.map((i) => ({ id: i.id, date: i.date, kind: 'invoice' as const, title: i.customer, sub: i.number, amount: invoiceTotal(i) })),
    ...books.expenses.map((e) => ({ id: e.id, date: e.date, kind: 'expense' as const, title: e.supplier, sub: e.category, amount: -e.amount })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);

  return (
    <Screen title="Home">
      {/* Cash hero */}
      <View style={[styles.hero, { backgroundColor: t.hero }]}>
        <View style={styles.heroTop}>
          <Txt variant="label" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Cash on hand
          </Txt>
          <Icon ios="banknote" md="account_balance_wallet" size={20} color={Brand.emerald} />
        </View>
        <Txt variant="display" style={{ color: '#fff' }} accessibilityLabel={`Cash on hand ${peso(cash)}`}>
          {peso(cash)}
        </Txt>
        <View style={styles.heroFoot}>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Receivables
            </Txt>
            <Txt variant="figure" style={{ color: '#fff' }}>
              {peso(ar.total, { decimals: false })}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Overdue
            </Txt>
            <Txt variant="figure" style={{ color: overdue.length ? '#fca5a5' : '#fff' }}>
              {overdue.length} invoice{overdue.length === 1 ? '' : 's'}
            </Txt>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        <QuickAction
          label="Snap receipt"
          ios="camera.fill"
          md="photo_camera"
          onPress={() => router.push('/expense/new')}
        />
        <QuickAction
          label="New invoice"
          ios="doc.badge.plus"
          md="request_quote"
          onPress={() => router.push('/invoice/new')}
        />
      </View>

      {/* Period snapshot */}
      <SectionHeader title="Snapshot" />
      <Chips options={options} value={periodKey} onChange={setPeriodKey} />
      <View style={styles.tiles}>
        <Tile label="Sales" value={pesoShort(s.sales)} hint={`${s.invoiceCount} invoices · net of VAT`} />
        <Tile label="Expenses" value={pesoShort(s.expenses)} hint={`${s.expenseCount} records · net of VAT`} />
      </View>
      <Card>
        <View style={styles.netRow}>
          <View>
            <Txt variant="label">Net income</Txt>
            <Txt variant="caption">{period.label}</Txt>
          </View>
          <Txt variant="title" style={{ color: s.netIncome < 0 ? t.negative : t.positive, fontVariant: ['tabular-nums'] }}>
            {peso(s.netIncome, { decimals: false })}
          </Txt>
        </View>
        <MarginBar sales={s.sales} expenses={s.expenses} />
      </Card>

      {/* BIR deadlines */}
      <SectionHeader title="BIR deadlines" />
      <Card padded={false}>
        {upcoming.map((d, i) => {
          const days = daysBetween(today, d.due);
          return (
            <Row
              key={`${d.form}-${d.due}`}
              last={i === upcoming.length - 1}
              leading={
                <IconBadge tone={days <= 5 ? 'warning' : 'accent'}>
                  <Icon ios="calendar" md="event" size={18} color={days <= 5 ? t.warning : t.accent} />
                </IconBadge>
              }
              title={`${d.form} · ${d.title}`}
              subtitle={`Due ${shortDate(d.due)}`}
              trailing={<Pill label={days === 0 ? 'Today' : `${days}d`} tone={days <= 5 ? 'warning' : 'neutral'} />}
            />
          );
        })}
      </Card>

      {/* Recent activity */}
      <SectionHeader title="Recent activity" />
      <Card padded={false}>
        {activity.map((a, i) => (
          <Row
            key={a.id}
            last={i === activity.length - 1}
            onPress={a.kind === 'invoice' ? () => router.push({ pathname: '/invoice/[id]', params: { id: a.id } }) : undefined}
            leading={
              <IconBadge>
                <Icon
                  ios={a.kind === 'invoice' ? 'doc.text' : 'receipt'}
                  md={a.kind === 'invoice' ? 'request_quote' : 'receipt_long'}
                  size={18}
                  color={t.accent}
                />
              </IconBadge>
            }
            title={a.title}
            subtitle={`${a.sub} · ${shortDate(a.date)}`}
            trailing={
              <Txt variant="figure" style={{ color: a.amount < 0 ? t.text : t.positive }}>
                {a.amount < 0 ? `−${peso(-a.amount)}` : `+${peso(a.amount)}`}
              </Txt>
            }
          />
        ))}
      </Card>
    </Screen>
  );
}

function QuickAction({ label, ios, md, onPress }: { label: string; ios: string; md: 'photo_camera' | 'request_quote'; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <IconBadge>
        <Icon ios={ios as never} md={md} size={20} color={t.accent} />
      </IconBadge>
      <Txt variant="bodyStrong">{label}</Txt>
    </Pressable>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="title" style={{ marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {value}
      </Txt>
      <Txt variant="caption" numberOfLines={1}>
        {hint}
      </Txt>
    </Card>
  );
}

function MarginBar({ sales, expenses }: { sales: number; expenses: number }) {
  const t = useTheme();
  const spent = sales > 0 ? Math.min(expenses / sales, 1) : expenses > 0 ? 1 : 0;
  const margin = sales > 0 ? Math.round(((sales - expenses) / sales) * 100) : 0;
  return (
    <View style={{ marginTop: Spacing.three, gap: 6 }}>
      <View style={[styles.track, { backgroundColor: t.accentSoft }]}>
        <View style={[styles.fill, { width: `${spent * 100}%`, backgroundColor: spent >= 1 ? t.negative : t.accent }]} />
      </View>
      <Txt variant="caption">
        {sales > 0 ? `Expenses use ${Math.round(spent * 100)}% of sales · ${margin}% margin` : 'No sales recorded in this period yet'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroFoot: {
    flexDirection: 'row',
    marginTop: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  actions: { flexDirection: 'row', gap: Spacing.three },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tiles: { flexDirection: 'row', gap: Spacing.three },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
