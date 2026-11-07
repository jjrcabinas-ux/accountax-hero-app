import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { BrandMark, Button, Card } from '@/components/ui';
import { Brand, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseLinkCode, signInWithLinkCode } from '@/lib/session';

export default function SignInScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  async function submit(raw: string) {
    const parsed = parseLinkCode(raw);
    if (!parsed) {
      setError('That doesn’t look like a sign-in code. It has 8 letters and numbers.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithLinkCode(parsed);
    } catch (e) {
      setError((e as Error).message);
      handled.current = false;
      setBusy(false);
    }
  }

  async function startScan() {
    setError(null);
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        setError('Camera access is off. Type the code instead, or allow the camera in Settings.');
        return;
      }
    }
    handled.current = false;
    setScanning(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Brand.navy }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.wrap, { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.column}>
          <View style={styles.brand}>
            <BrandMark size={64} />
            <Txt variant="title" style={{ color: '#fff', textAlign: 'center' }}>
              AccounTax<Txt variant="title" style={{ color: Brand.emerald }}> Hero</Txt>
            </Txt>
            <Txt variant="body" style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Your books, on your phone.
            </Txt>
          </View>

          <Card style={{ gap: Spacing.three }}>
            <Txt variant="heading">Connect to your account</Txt>
            <View style={styles.steps}>
              <Step n={1} text="Open AccounTax Hero on your computer and sign in." />
              <Step n={2} text="Go to Settings › Sign-in & security › Phone app › Connect." />
              <Step n={3} text="Scan the code it shows, or type it below." />
            </View>

            {scanning ? (
              <View style={[styles.scanner, { borderColor: t.border }]}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={({ data }) => {
                    if (handled.current) return;
                    handled.current = true;
                    setScanning(false);
                    void submit(data);
                  }}
                />
                <View style={styles.frame} pointerEvents="none" />
              </View>
            ) : null}

            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={t.accent} />
                <Txt variant="body" color="textSecondary">Signing you in…</Txt>
              </View>
            ) : (
              <>
                <Button
                  label={scanning ? 'Stop scanning' : 'Scan code from the web app'}
                  kind={scanning ? 'secondary' : 'primary'}
                  onPress={() => (scanning ? setScanning(false) : void startScan())}
                  icon={scanning ? undefined : <Icon ios="qrcode.viewfinder" md="qr_code_scanner" size={20} color={t.accent === '#34d399' ? '#06281d' : '#fff'} />}
                />
                <View style={styles.or}>
                  <View style={[styles.rule, { backgroundColor: t.border }]} />
                  <Txt variant="caption">or type the code</Txt>
                  <View style={[styles.rule, { backgroundColor: t.border }]} />
                </View>
                <View style={styles.codeRow}>
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.toUpperCase())}
                    placeholder="ABCD 2345"
                    placeholderTextColor={t.textSecondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    accessibilityLabel="Sign-in code"
                    onSubmitEditing={() => void submit(code)}
                    style={[styles.codeInput, { color: t.text, borderColor: t.border, backgroundColor: t.surface }]}
                  />
                  <Button label="Sign in" onPress={() => void submit(code)} disabled={code.replace(/\s/g, '').length < 8} />
                </View>
              </>
            )}

            {error ? (
              <Txt variant="caption" style={{ color: t.negative }} accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
          </Card>

          <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
            The code works once and expires after 5 minutes. No text-message code is needed, because the web app has already checked it’s you.
          </Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: t.accentSoft }]}>
        <Txt variant="caption" style={{ color: t.accent, fontWeight: '700' }}>
          {n}
        </Txt>
      </View>
      <Txt variant="body" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  column: { width: '100%', maxWidth: 440 > MaxContentWidth ? MaxContentWidth : 440, gap: Spacing.four },
  brand: { alignItems: 'center', gap: Spacing.two },
  steps: { gap: 10 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  scanner: { height: 260, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  frame: {
    position: 'absolute',
    top: '18%',
    left: '22%',
    right: '22%',
    bottom: '18%',
    borderWidth: 3,
    borderColor: Brand.emerald,
    borderRadius: 16,
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  or: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  codeRow: { flexDirection: 'row', gap: Spacing.two },
  codeInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3,
  },
});
