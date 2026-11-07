/**
 * AccounTax Hero design tokens — the single source of truth for colour,
 * spacing, type and radius. Mirrors the web app: emerald accent on a slate
 * canvas, brand navy for hero surfaces.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Brand = {
  navy: '#0b1120',
  navyRaised: '#131c33',
  emerald: '#34d399',
  emeraldDeep: '#047857',
  teal: '#2dd4bf',
} as const;

export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#64748b',
    textOnBrand: '#ffffff',
    background: '#f1f5f9',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#e2e8f0',
    accent: Brand.emeraldDeep,
    accentSoft: '#d1fae5',
    positive: '#047857',
    negative: '#b91c1c',
    negativeSoft: '#fee2e2',
    warning: '#b45309',
    warningSoft: '#fef3c7',
    hero: Brand.navy,
    backgroundElement: '#ffffff',
    backgroundSelected: '#d1fae5',
  },
  dark: {
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    textOnBrand: '#ffffff',
    background: '#0b1120',
    surface: '#111a2e',
    surfaceMuted: '#0f172a',
    border: '#1e293b',
    accent: Brand.emerald,
    accentSoft: 'rgba(52, 211, 153, 0.14)',
    positive: '#34d399',
    negative: '#f87171',
    negativeSoft: 'rgba(248, 113, 113, 0.14)',
    warning: '#fbbf24',
    warningSoft: 'rgba(251, 191, 36, 0.14)',
    hero: Brand.navyRaised,
    backgroundElement: '#111a2e',
    backgroundSelected: 'rgba(52, 211, 153, 0.18)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = { [K in ThemeColor]: string };

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 0 }) ?? 0;
export const MaxContentWidth = 720;
