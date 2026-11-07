import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/screen';
import { Txt } from '@/components/txt';
import { AmountLine, Button, Card, Chips, Field } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { addExpense, VAT_RATE } from '@/data/store';
import type { ExpenseCategory } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { peso, round2, todayIso } from '@/utils/money';

const CATEGORIES: { key: ExpenseCategory; label: string }[] = (
  ['Supplies', 'Transportation', 'Meals', 'Utilities', 'Rent', 'Professional fees', 'Repairs', 'Others'] as const
).map((c) => ({ key: c, label: c }));

export default function NewExpenseScreen() {
  const t = useTheme();
  const router = useRouter();
  const [receiptUri, setReceiptUri] = useState<string>();
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [category, setCategory] = useState<ExpenseCategory>('Supplies');
  const [vatable, setVatable] = useState(true);
  const [note, setNote] = useState('');

  const gross = Number(amount.replace(/,/g, '')) || 0;
  const vat = vatable ? round2((gross * VAT_RATE) / (1 + VAT_RATE)) : 0;
  const valid = supplier.trim().length > 0 && gross > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  async function pick(source: 'camera' | 'library') {
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to snap receipts.');
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setReceiptUri(res.assets[0].uri);
  }

  function save() {
    if (!valid) return;
    addExpense({ supplier: supplier.trim(), amount: gross, date, category, vatable, receiptUri, note: note.trim() || undefined });
    router.back();
  }

  return (
    <Sheet>
      {receiptUri ? (
        <View>
          <Image source={{ uri: receiptUri }} style={[styles.receipt, { borderColor: t.border }]} contentFit="cover" />
          <Pressable
            accessibilityLabel="Remove receipt photo"
            onPress={() => setReceiptUri(undefined)}
            style={[styles.remove, { backgroundColor: t.surface }]}>
            <Icon ios="xmark" md="close" size={16} color={t.text} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.drop, { borderColor: t.border, backgroundColor: t.surface }]}>
          <Icon ios="doc.viewfinder" md="photo_camera" size={34} color={t.accent} />
          <Txt variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            Photograph the official receipt so it's on file for BIR.
          </Txt>
          <View style={styles.pickRow}>
            <Button label="Take photo" onPress={() => pick('camera')} style={{ flex: 1 }} />
            <Button label="Choose" kind="secondary" onPress={() => pick('library')} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      <Field label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="e.g. Wilcon Depot" autoCapitalize="words" />
      <View style={styles.pair}>
        <View style={{ flex: 1.3 }}>
          <Field label="Amount paid (₱)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        </View>
      </View>

      <Txt variant="label">Category</Txt>
      <Chips options={CATEGORIES} value={category} onChange={setCategory} />

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
            <AmountLine label="Net of VAT" value={peso(round2(gross - vat))} />
            <AmountLine label="Input VAT" value={peso(vat)} />
          </View>
        ) : null}
      </Card>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="What was it for?" />

      <Button label="Save expense" onPress={save} disabled={!valid} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  pickRow: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
  receipt: { width: '100%', height: 220, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  remove: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pair: { flexDirection: 'row', gap: Spacing.three },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
