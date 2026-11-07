import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { loadCustomers } from '@/books/customers';
import {
  addDays,
  invoiceNumberTaken,
  invoiceTotals,
  newId,
  nextDocNumber,
  nextInvoiceNumber,
  statusOf,
  TERMS,
  upsertInvoice,
  type Invoice,
  type InvoiceLine,
} from '@/books/invoices';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Chips } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { liveInvoices } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { peso, todayIso } from '@/utils/money';

type Draft = { item: string; qty: string; rate: string };
const blank = (): Draft => ({ item: '', qty: '1', rate: '' });
const TERM_CHIPS = TERMS.filter((x) => [0, 15, 30, 60].includes(x.days)).map((x) => ({ key: x.label, label: x.label }));

export default function NewInvoiceScreen() {
  const t = useTheme();
  const router = useRouter();

  // Customers billed most recently first.
  const customers = useMemo(() => {
    const last = new Map<string, string>();
    liveInvoices().forEach((i) => {
      if ((last.get(i.customerId) ?? '') < i.invoiceDate) last.set(i.customerId, i.invoiceDate);
    });
    return loadCustomers().sort((a, b) => (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? '') || a.name.localeCompare(b.name));
  }, []);

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [showAll, setShowAll] = useState(false);
  const [terms, setTerms] = useState('Net 30');
  const [vatable, setVatable] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([blank()]);
  const [number] = useState(() => nextInvoiceNumber());

  const today = todayIso();
  const customer = customers.find((c) => c.id === customerId);
  const lines: InvoiceLine[] = drafts
    .map((d) => ({ id: newId(), item: d.item.trim(), description: '', qty: Number(d.qty) || 0, rate: Number(d.rate.replace(/,/g, '')) || 0, vat: vatable ? ('vatable' as const) : ('exempt' as const) }))
    .filter((l) => l.item && l.qty > 0 && l.rate > 0);
  const totals = invoiceTotals({ lines, amountsAre: 'exclusive' });
  const valid = !!customer && lines.length > 0;

  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  function save() {
    if (!valid || !customer) return;
    const days = TERMS.find((x) => x.label === terms)?.days ?? 30;
    const inv: Invoice = {
      id: newId(),
      number,
      customerId: customer.id,
      customerName: customer.name,
      customerTin: customer.tin ?? '',
      customerEmail: undefined,
      billingAddress: (customer.address ?? '').trim(),
      invoiceDate: today,
      dueDate: addDays(today, days),
      terms,
      amountsAre: 'exclusive',
      lines,
      message: '',
      status: statusOf({ lines, amountsAre: 'exclusive', payments: [] }),
      payments: [],
      createdAt: new Date().toISOString(),
    };
    // Same rule as the web: if another device took this number meanwhile, use the next free one.
    if (invoiceNumberTaken(inv.number, inv.id, 'invoice')) {
      inv.number = nextDocNumber('invoice');
      Alert.alert(`Saved as ${inv.number}`, `${number} was already used by another invoice, so this one took the next free number.`);
    }
    upsertInvoice(inv);
    router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } });
  }

  const inputStyle = [styles.cell, { color: t.text, borderColor: t.border, backgroundColor: t.surface }];
  const customerChips = (showAll ? customers : customers.slice(0, 6)).map((c) => ({ key: c.id, label: c.name }));

  return (
    <Sheet>
      <Txt variant="caption">{number} · dated today</Txt>

      <Txt variant="label">Customer</Txt>
      {customers.length === 0 ? (
        <Txt variant="caption">No customers yet. Add one in the web app first.</Txt>
      ) : (
        <Chips options={customerChips} value={customerId} onChange={setCustomerId} />
      )}
      {customers.length > 6 ? (
        <Button kind="ghost" label={showAll ? 'Show fewer customers' : `Show all ${customers.length} customers`} onPress={() => setShowAll((x) => !x)} />
      ) : null}

      <Txt variant="label">Payment terms</Txt>
      <Chips options={TERM_CHIPS} value={terms} onChange={setTerms} />

      <Txt variant="label">Items</Txt>
      {drafts.map((d, i) => (
        <Card key={i} style={{ gap: Spacing.two }}>
          <View style={styles.lineHead}>
            <TextInput
              value={d.item}
              onChangeText={(v) => update(i, { item: v })}
              placeholder="Product or service"
              placeholderTextColor={t.textSecondary}
              style={[inputStyle, { flex: 1 }]}
            />
            {drafts.length > 1 ? (
              <Pressable accessibilityLabel="Remove item" onPress={() => setDrafts((ds) => ds.filter((_, idx) => idx !== i))} style={styles.removeBtn}>
                <Icon ios="trash" md="delete" size={18} color={t.negative} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.lineNums}>
            <TextInput
              value={d.qty}
              onChangeText={(v) => update(i, { qty: v })}
              keyboardType="number-pad"
              accessibilityLabel="Quantity"
              style={[inputStyle, { width: 72, textAlign: 'center' }]}
            />
            <Txt variant="body" color="textSecondary">×</Txt>
            <TextInput
              value={d.rate}
              onChangeText={(v) => update(i, { rate: v })}
              placeholder="Rate ₱ (before VAT)"
              placeholderTextColor={t.textSecondary}
              keyboardType="decimal-pad"
              accessibilityLabel="Rate"
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
        </Card>
      ))}
      <Button label="Add item" kind="ghost" onPress={() => setDrafts((ds) => [...ds, blank()])} icon={<Icon ios="plus" md="add" size={18} color={t.accent} />} />

      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Add 12% VAT</Txt>
            <Txt variant="caption">Turn off for VAT-exempt sales</Txt>
          </View>
          <Switch value={vatable} onValueChange={setVatable} trackColor={{ true: t.accent }} />
        </View>
        <View style={{ marginTop: Spacing.two }}>
          <AmountLine label={vatable ? 'VATable sales' : 'VAT-exempt sales'} value={peso(totals.subtotal)} />
          <AmountLine label="VAT (12%)" value={peso(totals.vat)} />
          <AmountLine label="Total amount due" value={peso(totals.total)} strong />
        </View>
      </Card>

      <Button label="Create invoice" onPress={save} disabled={!valid} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cell: { minHeight: 44, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 12, fontSize: 16 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  lineNums: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  removeBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
