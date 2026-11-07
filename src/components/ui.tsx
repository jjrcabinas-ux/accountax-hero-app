/** Small shared building blocks: cards, buttons, pills, chips, rows, fields. */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Txt } from './txt';

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, padded && styles.cardPad, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="label">{title}</Txt>
      {action}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  kind?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, icon, kind = 'primary', disabled, style }: ButtonProps) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'secondary' ? t.accentSoft : 'transparent';
  const fg = kind === 'primary' ? (t.accent === '#34d399' ? '#06281d' : '#ffffff') : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {icon}
      <Txt variant="bodyStrong" style={{ color: fg }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const PILL_TONES = {
  positive: ['accentSoft', 'positive'],
  negative: ['negativeSoft', 'negative'],
  warning: ['warningSoft', 'warning'],
  neutral: ['surfaceMuted', 'textSecondary'],
} as const;

export function Pill({ label, tone }: { label: string; tone: keyof typeof PILL_TONES }) {
  const t = useTheme();
  const [bg, fg] = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t[bg] }]}>
      <Txt variant="caption" style={{ color: t[fg], fontWeight: '600' }}>
        {label}
      </Txt>
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[
              styles.chip,
              { borderColor: on ? t.accent : t.border, backgroundColor: on ? t.accentSoft : t.surface },
            ]}>
            <Txt variant="caption" style={{ color: on ? t.accent : t.textSecondary, fontWeight: '600' }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable list row: leading slot, title + subtitle, trailing slot. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  last,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.row, !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {leading}
      <View style={styles.rowText}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

export function IconBadge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'warning' | 'negative' }) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accentSoft : tone === 'warning' ? t.warningSoft : t.negativeSoft;
  return <View style={[styles.iconBadge, { backgroundColor: bg }]}>{children}</View>;
}

export function Field({ label, style, ...input }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        placeholderTextColor={t.textSecondary}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: t.border },
          style,
        ]}
        {...input}
      />
    </View>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/brand/mark.png')}
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
      contentFit="cover"
      accessibilityLabel="AccounTax Hero"
    />
  );
}

/** Two-column label/amount line used in totals and statements. */
export function AmountLine({
  label,
  value,
  strong,
  indent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <View style={[styles.amountLine, indent && { paddingLeft: Spacing.three }]}>
      <Txt variant={strong ? 'bodyStrong' : 'body'} style={styles.amountLabel} numberOfLines={2}>
        {label}
      </Txt>
      <Txt variant="figure" style={!strong && { fontWeight: '400' }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardPad: { padding: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12, paddingHorizontal: Spacing.three },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  iconBadge: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  amountLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 6, gap: Spacing.three },
  amountLabel: { flex: 1 },
});
