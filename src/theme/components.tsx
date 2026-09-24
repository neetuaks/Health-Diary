import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, radius, typography } from './tokens';

// The standard Material Design "share" glyph (three connected nodes) — the
// globally recognized share icon on Android, rather than a plain arrow that
// isn't immediately read as "share" by everyone. react-native-svg is already a
// dependency (via victory-native), so this needs no new package.
export function ShareIcon({ size = 20, color = colors.primaryDark }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
      />
    </Svg>
  );
}

// Uses react-native-safe-area-context (not core RN's SafeAreaView, which is iOS-only
// and silently does nothing on Android) so every screen avoids the status bar/notch
// on both platforms. topInset defaults on since most screens render with no native
// header above them; the tab screens (which sit below the custom profile header)
// pass topInset={false} to avoid double-padding.
export function Screen({
  children,
  scroll,
  style,
  topInset = true,
  bottomInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  topInset?: boolean;
  bottomInset?: boolean;
}) {
  const edges: Edge[] = ['left', 'right', ...(topInset ? (['top'] as Edge[]) : []), ...(bottomInset ? (['bottom'] as Edge[]) : [])];
  const Container = scroll ? ScrollView : View;
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <Container style={[styles.screen, style]} {...(scroll ? { contentContainerStyle: { paddingBottom: spacing.xl } } : {})}>
        {children}
      </Container>
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
type ButtonSize = 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const variantStyle = buttonVariants[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[styles.button, size === 'sm' && styles.buttonSm, variantStyle.container, disabled && styles.buttonDisabled, style]}
    >
      <Text style={[styles.buttonLabel, size === 'sm' && styles.buttonLabelSm, variantStyle.label]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// A rounded, single-row tab group (date-range pickers, etc.) — the pill-segment
// look used throughout the reference design instead of a row of separate chips.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={[styles.segment, value === opt.key && styles.segmentActive]}
        >
          <Text style={[styles.segmentLabel, value === opt.key && styles.segmentLabelActive]} numberOfLines={1}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// A full-width, tappable row for navigation ("beautiful button" style list item) —
// used for Settings entries, profile rows, backup rows, etc. instead of bare text links.
export function ListButton({
  label,
  subtitle,
  onPress,
  destructive,
  showChevron = true,
  style,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={[styles.listButton, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, destructive ? { color: colors.danger, fontWeight: '600' } : null]}>{label}</Text>
        {subtitle ? <Text style={[typography.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {showChevron && <Text style={styles.chevron}>{'›'}</Text>}
    </TouchableOpacity>
  );
}

type BannerVariant = 'info' | 'warning' | 'danger';

export function Banner({
  variant = 'info',
  title,
  message,
  onPress,
  onDismiss,
}: {
  variant?: BannerVariant;
  title?: string;
  message: string;
  onPress?: () => void;
  onDismiss?: () => void;
}) {
  const variantStyle = bannerVariants[variant];
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper onPress={onPress} style={[styles.banner, variantStyle.container]}>
      {title ? <Text style={[styles.bannerTitle, variantStyle.text]}>{title}</Text> : null}
      <Text style={[styles.bannerMessage, variantStyle.text]}>{message}</Text>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss}>
          <Text style={[styles.bannerDismiss, variantStyle.text]}>Dismiss</Text>
        </TouchableOpacity>
      ) : null}
    </Wrapper>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={typography.h2}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, styles.emptySubtitle]}>{subtitle}</Text> : null}
    </View>
  );
}

const shadow = {
  shadowColor: '#0B1A2B',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 2,
};

const buttonVariants: Record<ButtonVariant, { container: ViewStyle; label: TextStyle }> = {
  // Muted (soft-tinted background + dark-tinted text) rather than a solid fill —
  // calmer, per the "calm blue/green, red only for alerts" direction. Destructive
  // stays a solid fill deliberately: it's a safety-relevant action, not everyday CTA.
  primary: { container: { backgroundColor: colors.primaryMuted, ...shadow }, label: { color: colors.primaryDark } },
  secondary: { container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, ...shadow }, label: { color: colors.primary } },
  destructive: { container: { backgroundColor: colors.danger, ...shadow }, label: { color: colors.textOnPrimary } },
  // No shadow: a ghost button has no fill, so the shared drop shadow would
  // otherwise render as a fuzzy floating box around the text instead of a
  // clean, borderless link.
  ghost: { container: { backgroundColor: 'transparent' }, label: { color: colors.primary } },
};

const bannerVariants: Record<BannerVariant, { container: ViewStyle; text: TextStyle }> = {
  info: { container: { backgroundColor: colors.primaryMuted }, text: { color: colors.primaryDark } },
  warning: { container: { backgroundColor: colors.warningBg }, text: { color: colors.warning } },
  danger: { container: { backgroundColor: colors.dangerBg }, text: { color: colors.danger } },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  button: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonSm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  buttonLabelSm: { fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow },
  segmented: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  segmentLabelActive: { color: colors.primary },
  listButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
  banner: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  bannerTitle: { fontWeight: '700', marginBottom: spacing.xs },
  bannerMessage: { fontSize: 14 },
  bannerDismiss: { marginTop: spacing.sm, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: spacing.xxl },
  emptySubtitle: { marginTop: spacing.xs, textAlign: 'center' },
});
