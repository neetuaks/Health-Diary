// Calm blue/green medical-app palette. Red is reserved for out-of-range/destructive states only.
export const colors = {
  primary: '#0077CC',
  primaryDark: '#005A99',
  primaryMuted: '#EAF6FF',
  secondary: '#00AA77',
  secondaryMuted: '#E6F7F1',

  // Pulse's "Low (Bradycardia)" tier uses blue, not red — its age-band reference
  // chart doesn't treat a low reading with the same urgency as low BP/glucose.
  // Same values as primary/primaryMuted, named separately for that semantic meaning.
  info: '#0077CC',
  infoBg: '#EAF6FF',

  success: '#1F9254',
  successBg: '#E7F7EE',
  // warning/orange/danger are deliberately spread across distinct hues (~45°/20°/0°),
  // not just different shades of the same reddish-brown — the previous values
  // (#B7791F / #C2540A / #D9534F) all clustered within ~35° of each other and read
  // as indistinguishable "shades of red" rather than yellow vs orange vs red.
  warning: '#CA8A04',
  warningBg: '#FEF3C7',
  // Fourth clinical-severity step (AHA Hypertension Stage 1) between warning and
  // danger — heart.org's chart escalates through more than a 3-color scale.
  orange: '#EA580C',
  orangeBg: '#FFEDD5',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',

  text: '#1A2B3C',
  textMuted: '#667085',
  textOnPrimary: '#FFFFFF',

  border: '#E2E8F0',
  background: '#F7FAFC',
  surface: '#FFFFFF',
} as const;

// Chart series identity (which line is Systolic vs Diastolic vs Pulse) — deliberately
// disjoint from the clinical severity palette above (success/warning/orange/danger/
// info). Reusing those for series color made a reading's clinical-severity dot color
// coincidentally match a line's identity color (e.g. Systolic's line and a
// "Low (Bradycardia)" pulse dot were literally the same blue), so a series color here
// could never be mistaken for what the point coloring means.
export const chartSeriesColors = ['#4F46E5', '#0D9488', '#9333EA'] as const;

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
