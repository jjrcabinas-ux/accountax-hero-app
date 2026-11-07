import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Pill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { customers } from '@/data/sample';
import {
  invoiceNet,
  invoiceStatus,
  invoiceTotal,
  invoiceVat,
  markInvoicePaid,
  STATUS_TONE,
  useBooks,
} from '@/data/store';
import { useTheme } from '@/hooks/use-theme';
import { shareInvoicePdf } from '@/utils/invoice-pdf';
import { longDate, peso } from '@/utils/money';

export default function InvoiceDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const books = useBooks();
  const inv = books.invoices.find((i) => i.id === id);
  const [sharing, setSharing] = useState(false);

  if (!inv) {
    return (
      <Sheet>
        <Txt variant="body">This invoice no longer exists.</Txt>
      </Sheet>
    );
  }

  const status = invoiceStatus(inv);
  const cust = customers.find((c) => c.name === inv.customer);

  async function share() {
    if (!inv) return;
    setSharing(true);
    try {
      await shareInvoicePdf(inv);
    } catch (e) {
      Alert.alert('Could not create PDF', String(e));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Sheet>
      <Stack.Screen options={{ title: inv.number }} />

      <Card style={{ gap: Spacing.two }}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Txt variant="label">Billed to</Txt>
            <Txt variant="heading">{inv.customer}</Txt>
            {cust ? <Txt variant="caption">TIN {cust.tin} · {cust.address}</Txt> : null}
          </View>
          <Pill label={status} tone={STATUS_TONE[status]} />
        </View>
        <View style={styles.dates}>
          <View>
            <Txt variant="caption">Date</Txt>
            <Txt variant="bodyStrong">{longDate(inv.date)}</Txt>
          </View>
          <View>
            <Txt variant="caption">Due</Txt>
            <Txt variant="bodyStrong">{longDate(inv.dueDate)}</Txt>
          </View>
          {inv.paidDate ? (
            <View>
              <Txt variant="caption">Paid</Txt>
              <Txt variant="bodyStrong">{longDate(inv.paidDate)}</Txt>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <Txt variant="label">Items</Txt>
        {inv.lines.map((l, i) => (
          <View key={i} style={[styles.line, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">{l.description}</Txt>
              <Txt variant="caption">
                {l.qty} × {peso(l.price)}
              </Txt>
            </View>
            <Txt variant="figure">{peso(l.qty * l.price)}</Txt>
          </View>
        ))}
        <View style={{ marginTop: Spacing.two }}>
          <AmountLine label={inv.vatable ? 'VATable sales' : 'VAT-exempt sales'} value={peso(invoiceNet(inv))} />
          <AmountLine label="VAT (12%)" value={peso(invoiceVat(inv))} />
          <AmountLine label="Total amount due" value={peso(invoiceTotal(inv))} strong />
        </View>
      </Card>

      <Button
        label={sharing ? 'Preparing PDF…' : 'Share as PDF'}
        disabled={sharing}
        onPress={share}
        icon={<Icon ios="square.and.arrow.up" md="ios_share" size={18} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
      />
      {status !== 'Paid' ? (
        <Button
          label="Mark as paid"
          kind="secondary"
          onPress={() => markInvoicePaid(inv.id)}
          icon={<Icon ios="checkmark.circle" md="check_circle" size={18} color={t.accent} />}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  dates: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
