import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { getInvoice, invoiceBalance, invoiceTotals, lineAmounts, newId, statusOf, upsertInvoice, type Invoice } from '@/books/invoices';
import { canWrite } from '@/books/sync';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Chips, Pill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { cashAccounts, invoiceStatus, useBooksVersion } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { shareInvoicePdf } from '@/utils/invoice-pdf';
import { longDate, peso, todayIso } from '@/utils/money';

export default function InvoiceDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  useBooksVersion();
  const inv = getInvoice(id);
  const [sharing, setSharing] = useState(false);
  const [paying, setPaying] = useState(false);
  const cash = cashAccounts();
  const [cashId, setCashId] = useState(cash[0]?.id ?? '');

  if (!inv) {
    return (
      <Sheet>
        <Txt variant="body">This invoice isn’t in the books (it may still be syncing, or it was deleted on the web).</Txt>
      </Sheet>
    );
  }

  const st = invoiceStatus(inv);
  const totals = invoiceTotals(inv);
  const balance = invoiceBalance(inv);

  async function share(i: Invoice) {
    setSharing(true);
    try {
      await shareInvoicePdf(i);
    } catch (e) {
      Alert.alert('Could not create the PDF', String(e));
    } finally {
      setSharing(false);
    }
  }

  function recordPayment(i: Invoice) {
    const acct = cash.find((c) => c.id === cashId);
    if (!acct) return;
    const payments = [
      ...(i.payments ?? []),
      { id: newId(), date: todayIso(), amount: invoiceBalance(i), taxWithheld: 0, accountId: acct.id, accountName: acct.name, method: 'Cash', reference: '' },
    ];
    upsertInvoice({ ...i, payments, status: statusOf({ ...i, payments }) });
    setPaying(false);
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: inv.number }} />

      <Card style={{ gap: Spacing.two }}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Txt variant="label">Billed to</Txt>
            <Txt variant="heading">{inv.customerName || 'No customer'}</Txt>
            {inv.customerTin || inv.billingAddress ? (
              <Txt variant="caption">{[inv.customerTin && `TIN ${inv.customerTin}`, inv.billingAddress].filter(Boolean).join(' · ')}</Txt>
            ) : null}
          </View>
          <Pill label={st.label} tone={st.tone} />
        </View>
        <View style={styles.dates}>
          <View>
            <Txt variant="caption">Date</Txt>
            <Txt variant="bodyStrong">{longDate(inv.invoiceDate)}</Txt>
          </View>
          <View>
            <Txt variant="caption">Due</Txt>
            <Txt variant="bodyStrong">{longDate(inv.dueDate)}</Txt>
          </View>
          <View>
            <Txt variant="caption">Terms</Txt>
            <Txt variant="bodyStrong">{inv.terms}</Txt>
          </View>
        </View>
      </Card>

      <Card>
        <Txt variant="label">Items</Txt>
        {inv.lines.map((l) => (
          <View key={l.id} style={[styles.line, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">{l.item || l.description}</Txt>
              <Txt variant="caption">
                {l.qty} × {peso(l.rate)}
                {l.vat !== 'vatable' ? ` · VAT ${l.vat === 'zero' ? 'zero-rated' : 'exempt'}` : ''}
              </Txt>
            </View>
            <Txt variant="figure">{peso(lineAmounts(l, inv.amountsAre).net)}</Txt>
          </View>
        ))}
        <View style={{ marginTop: Spacing.two }}>
          <AmountLine label="Sales, net of VAT" value={peso(totals.subtotal)} />
          <AmountLine label="VAT (12%)" value={peso(totals.vat)} />
          <AmountLine label="Total amount due" value={peso(totals.total)} strong />
          {(inv.payments ?? []).length > 0 ? <AmountLine label="Still owed" value={peso(balance)} strong /> : null}
        </View>
      </Card>

      <Button
        label={sharing ? 'Preparing PDF…' : 'Share as PDF'}
        disabled={sharing}
        onPress={() => void share(inv)}
        icon={<Icon ios="square.and.arrow.up" md="ios_share" size={18} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
      />

      {balance > 0.005 && canWrite('invoices') && cash.length > 0 ? (
        paying ? (
          <Card style={{ gap: Spacing.two }}>
            <Txt variant="bodyStrong">Record {peso(balance)} received today</Txt>
            <Txt variant="label">Deposited to</Txt>
            <Chips options={cash.map((c) => ({ key: c.id, label: c.name }))} value={cashId} onChange={setCashId} />
            <Txt variant="caption">If the customer withheld tax or paid only part, record it in the web app instead.</Txt>
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button label="Cancel" kind="secondary" onPress={() => setPaying(false)} style={{ flex: 1 }} />
              <Button label="Record payment" onPress={() => recordPayment(inv)} style={{ flex: 1.4 }} />
            </View>
          </Card>
        ) : (
          <Button
            label="Record payment"
            kind="secondary"
            onPress={() => setPaying(true)}
            icon={<Icon ios="checkmark.circle" md="check_circle" size={18} color={t.accent} />}
          />
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  dates: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one, flexWrap: 'wrap' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
