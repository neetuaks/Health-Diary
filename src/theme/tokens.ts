// Calm blue/green medical-app palette. Red is reserved for out-of-range/destructive states only.
export const colors = {
  primary: '#0077CC',
  primaryDark: '#005A99',
  primaryMuted: '#EAF6FF',
  secondary: '#00AA77',
  secondaryMuted: '#E6F7F1',

  success: '#1F9254',
  successBg: '#E7F7EE',
  warning: '#B7791F',
  warningBg: '#FFF4E5',
  danger: '#D9534F',
  dangerBg: '#FDEDEC',

  text: '#1A2B3C',
  textMuted: '#667085',
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  background: '#F7FAFC',
  surface: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
  numberLarge: { fontSize: 32, fontWeight: '700' as const, color: colors.text },
};
