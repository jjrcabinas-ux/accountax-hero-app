import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { type Account } from '@/books/coa';
import { expenseTotals, netPayable, nextExpenseNumber, statusOf, upsertExpense, type Expense } from '@/books/expenses';
import { newId } from '@/books/invoices';
import { loadSuppliers, upsertSupplier, type Supplier } from '@/books/suppliers';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Chips, Field } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { cashAccounts, expenseAccounts, liveExpenses } from '@/data/live';
import { useTheme } from '@/hooks/use-theme';
import { peso, todayIso } from '@/utils/money';

const NEW_SUPPLIER = '__new__';

export default function NewExpenseScreen() {
  const t = useTheme();
  const router = useRouter();

  // Most-used first, so the usual suspects are one tap away.
  const { suppliers, accounts, cash } = useMemo(() => {
    const recent = liveExpenses();
    const supUse = new Map<string, number>();
    const accUse = new Map<string, number>();
    recent.forEach((e) => {
      supUse.set(e.supplierId, (supUse.get(e.supplierId) ?? 0) + 1);
      e.lines.forEach((l) => accUse.set(l.accountId, (accUse.get(l.accountId) ?? 0) + 1));
    });
    const sups = loadSuppliers().sort((a, b) => (supUse.get(b.id) ?? 0) - (supUse.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    const accs = expenseAccounts().sort((a, b) => (accUse.get(b.id) ?? 0) - (accUse.get(a.id) ?? 0));
    return { suppliers: sups, accounts: accs, cash: cashAccounts() };
  }, []);

  const [receiptUri, setReceiptUri] = useState<string>();
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id ?? NEW_SUPPLIER);
  const [newSupplier, setNewSupplier] = useState('');
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [vatable, setVatable] = useState(suppliers[0]?.vatStatus !== 'nonvat');
  const [paid, setPaid] = useState(cash.length > 0);
  const [cashId, setCashId] = useState(cash[0]?.id ?? '');
  const [note, setNote] = useState('');

  const supplier = suppliers.find((s) => s.id === supplierId);
  const account = accounts.find((a) => a.id === accountId);
  const gross = Number(amount.replace(/,/g, '')) || 0;
  const draftLines = account
    ? [{ id: 'draft', accountId: account.id, accountCode: account.code, accountName: account.name, description: '', amount: gross, vat: vatable ? ('vatable' as const) : ('exempt' as const) }]
    : [];
  const totals = expenseTotals({ lines: draftLines, amountsAre: 'inclusive' });
  const hasSupplier = supplierId === NEW_SUPPLIER ? newSupplier.trim().length > 0 : !!supplier;
  const valid = hasSupplier && !!account && gross > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && (!paid || !!cashId);

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    if (s) setVatable(s.vatStatus !== 'nonvat');
  };

  async function pick(source: 'camera' | 'library') {
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to snap receipts.');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setReceiptUri(res.assets[0].uri);
  }

  function save() {
    if (!valid || !account) return;
    let sup: Supplier | undefined = supplier;
    if (supplierId === NEW_SUPPLIER) {
      const name = newSupplier.trim();
      sup = loadSuppliers().find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
      if (!sup) {
        sup = { id: newId(), name, tin: '', address: '', contactPerson: '', contactNumber: '', balance: 0, createdAt: new Date().toISOString() };
        upsertSupplier(sup);
      }
    }
    if (!sup) return;

    const lines: Expense['lines'] = [
      { id: newId(), accountId: account.id, accountCode: account.code, accountName: account.name, description: note.trim(), amount: gross, vat: vatable ? 'vatable' : 'exempt' },
    ];
    const base = { lines, amountsAre: 'inclusive' as const, withholds: false };
    const cashAcct: Account | undefined = cash.find((c) => c.id === cashId);
    const payments =
      paid && cashAcct
        ? [{ id: newId(), date, amount: netPayable(base), taxWithheld: 0, accountId: cashAcct.id, accountName: cashAcct.name, method: 'Cash', reference: '' }]
        : [];

    const exp: Expense = {
      id: newId(),
      number: nextExpenseNumber(),
      supplierId: sup.id,
      supplierName: sup.name,
      supplierTin: sup.tin,
      date,
      dueDate: date,
      terms: 'Due on receipt',
      amountsAre: 'inclusive',
      lines,
      withholds: false,
      withholdingRate: undefined,
      ewt: undefined,
      memo: note.trim(),
      status: statusOf({ ...base, payments }),
      payments,
      createdAt: new Date().toISOString(),
    };
    upsertExpense(exp);
    router.back();
  }

  const supplierOptions = [
    ...(showAllSuppliers ? suppliers : suppliers.slice(0, 6)).map((s) => ({ key: s.id, label: s.name })),
    { key: NEW_SUPPLIER, label: '+ New supplier' },
  ];
  const accountOptions = (showAllAccounts ? accounts : accounts.slice(0, 8)).map((a) => ({ key: a.id, label: a.name }));

  return (
    <Sheet>
      {receiptUri ? (
        <View>
          <Image source={{ uri: receiptUri }} style={[styles.receipt, { borderColor: t.border }]} contentFit="cover" />
          <Pressable accessibilityLabel="Remove receipt photo" onPress={() => setReceiptUri(undefined)} style={[styles.remove, { backgroundColor: t.surface }]}>
            <Icon ios="xmark" md="close" size={16} color={t.text} />
          </Pressable>
          <Txt variant="caption" style={{ marginTop: 6 }}>
            Use the photo to fill in the details. It stays on this phone for now; attaching receipts to the books comes in a later update.
          </Txt>
        </View>
      ) : (
        <View style={[styles.drop, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Icon ios="doc.viewfinder" md="photo_camera" size={34} color={t.accent} />
          <Txt variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            Snap the receipt, then fill in the details from it.
          </Txt>
          <View style={styles.pickRow}>
            <Button label="Take photo" onPress={() => pick('camera')} style={{ flex: 1 }} />
            <Button label="Choose" kind="secondary" onPress={() => pick('library')} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      <Txt variant="label">Supplier</Txt>
      <Chips options={supplierOptions} value={supplierId} onChange={pickSupplier} />
      {suppliers.length > 6 ? (
        <Button kind="ghost" label={showAllSuppliers ? 'Show fewer suppliers' : `Show all ${suppliers.length} suppliers`} onPress={() => setShowAllSuppliers((x) => !x)} />
      ) : null}
      {supplierId === NEW_SUPPLIER ? (
        <Field label="New supplier name" value={newSupplier} onChangeText={setNewSupplier} placeholder="e.g. Wilcon Depot" autoCapitalize="words" />
      ) : null}

      <View style={styles.pair}>
        <View style={{ flex: 1.3 }}>
          <Field label="Amount paid (₱)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </View>
      </View>

      <Txt variant="label">Category</Txt>
      {accounts.length === 0 ? (
        <Txt variant="caption">No expense accounts yet. Add one in the web app’s chart of accounts.</Txt>
      ) : (
        <Chips options={accountOptions} value={accountId} onChange={setAccountId} />
      )}
      {accounts.length > 8 ? (
        <Button kind="ghost" label={showAllAccounts ? 'Show fewer categories' : `Show all ${accounts.length} categories`} onPress={() => setShowAllAccounts((x) => !x)} />
      ) : null}

      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">VAT receipt</Txt>
            <Txt variant="caption">Amount includes 12% VAT from a VAT-registered supplier</Txt>
          </View>
          <Switch value={vatable} onValueChange={setVatable} trackColor={{ true: t.accent }} />
        </View>
        {gross > 0 ? (
          <View style={{ marginTop: Spacing.two }}>
            <AmountLine label="Net of VAT" value={peso(totals.subtotal)} />
            <AmountLine label="Input VAT" value={peso(totals.vat)} />
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Already paid</Txt>
            <Txt variant="caption">{paid ? 'Records the payment too' : 'Saved as an unpaid bill'}</Txt>
          </View>
          <Switch value={paid} onValueChange={setPaid} trackColor={{ true: t.accent }} disabled={cash.length === 0} />
        </View>
        {paid && cash.length > 0 ? (
          <>
            <Txt variant="label">Paid from</Txt>
            <Chips options={cash.map((c) => ({ key: c.id, label: c.name }))} value={cashId} onChange={setCashId} />
          </>
        ) : null}
      </Card>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="What was it for?" />

      <Button label="Save expense" onPress={save} disabled={!valid} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  drop: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: Radius.lg, padding: Spacing.four, alignItems: 'center', gap: Spacing.three },
  pickRow: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
  receipt: { width: '100%', height: 220, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  remove: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
