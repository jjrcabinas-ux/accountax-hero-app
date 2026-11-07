import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Chips, Field } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { customers } from '@/data/sample';
import { addInvoice, invoiceNet, invoiceTotal, invoiceVat, nextInvoiceNumber } from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { addDays, peso, todayIso } from '@/utils/money';

type Draft = { description: string; qty: string; price: string };
const blank = (): Draft => ({ description: '', qty: '1', price: '' });

const TERMS = [
  { key: '0', label: 'Due now' },
  { key: '15', label: '15 days' },
  { key: '30', label: '30 days' },
  { key: '60', label: '60 days' },
] as const;

export default function NewInvoiceScreen() {
  const t = useTheme();
  const router = useRouter();
  const [customer, setCustomer] = useState(customers[0].name);
  const [terms, setTerms] = useState<(typeof TERMS)[number]['key']>('30');
  const [vatable, setVatable] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([blank()]);

  const today = todayIso();
  const lines = drafts
    .map((d) => ({ description: d.description.trim(), qty: Number(d.qty) || 0, price: Number(d.price.replace(/,/g, '')) || 0 }))
    .filter((l) => l.description && l.qty > 0 && l.price > 0);
  const preview = { lines, vatable };
  const valid = lines.length > 0;

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  function save() {
    if (!valid) return;
    const inv = addInvoice({ customer, date: today, dueDate: addDays(today, Number(terms)), lines, vatable });
    router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } });
  }

  const inputStyle = [styles.cell, { color: t.text, borderColor: t.border, backgroundColor: t.surface }];

  return (
    <Sheet>
      <Txt variant="caption">
        {nextInvoiceNumber()} · dated today
      </Txt>

      <Txt variant="label">Customer</Txt>
      <Chips options={customers.map((c) => ({ key: c.name, label: c.name }))} value={customer} onChange={setCustomer} />

      <Txt variant="label">Payment terms</Txt>
      <Chips options={TERMS} value={terms} onChange={setTerms} />

      <Txt variant="label">Items</Txt>
      {drafts.map((d, i) => (
        <Card key={i} style={{ gap: Spacing.two }}>
          <View style={styles.lineHead}>
            <TextInput
              value={d.description}
              onChangeText={(v) => update(i, { description: v })}
              placeholder="Description"
              placeholderTextColor={t.textSecondary}
              style={[inputStyle, { flex: 1 }]}
            />
            {drafts.length > 1 ? (
              <Pressable
                accessibilityLabel="Remove item"
                onPress={() => setDrafts((ds) => ds.filter((_, idx) => idx !== i))}
                style={styles.removeBtn}>
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
              value={d.price}
              onChangeText={(v) => update(i, { price: v })}
              placeholder="Unit price ₱"
              placeholderTextColor={t.textSecondary}
              keyboardType="decimal-pad"
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
          <AmountLine label={vatable ? 'VATable sales' : 'VAT-exempt sales'} value={peso(invoiceNet(preview))} />
          <AmountLine label="VAT (12%)" value={peso(invoiceVat(preview))} />
          <AmountLine label="Total amount due" value={peso(invoiceTotal(preview))} strong />
        </View>
      </Card>

      <Field label="Customer email" value={customers.find((c) => c.name === customer)?.email ?? ''} editable={false} />

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
