import { StyleSheet, Text, type TextProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'figure';

export type TxtProps = TextProps & { variant?: Variant; color?: ThemeColor };

export function Txt({ variant = 'body', color, style, ...rest }: TxtProps) {
  const theme = useTheme();
  const fallback: ThemeColor = variant === 'caption' || variant === 'label' ? 'textSecondary' : 'text';
  return <Text style={[{ color: theme[color ?? fallback] }, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  figure: { fontSize: 15, lineHeight: 21, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
