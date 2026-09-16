import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export function Screen({ children, scroll, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const Container = scroll ? ScrollView : View;
  return (
    <Container style={[styles.screen, style]} {...(scroll ? { contentContainerStyle: { paddingBottom: spacing.xl } } : {})}>
      {children}
    </Container>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const variantStyle = buttonVariants[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, variantStyle.container, disabled && styles.buttonDisabled, style]}
    >
      <Text style={[styles.buttonLabel, variantStyle.label]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
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

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: { label: string; onPress: () => void; destructive?: boolean }[];
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetContainer}>
          {title ? <Text style={[typography.caption, styles.sheetTitle]}>{title}</Text> : null}
          {actions.map((a, i) => (
            <TouchableOpacity key={i} style={styles.sheetAction} onPress={() => { onClose(); a.onPress(); }}>
              <Text style={[typography.bodyBold, { color: a.destructive ? colors.danger : colors.primary }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.sheetAction} onPress={onClose}>
            <Text style={typography.body}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const buttonVariants: Record<ButtonVariant, { container: ViewStyle; label: TextStyle }> = {
  primary: { container: { backgroundColor: colors.primary }, label: { color: colors.textOnPrimary } },
  secondary: { container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary }, label: { color: colors.primary } },
  destructive: { container: { backgroundColor: colors.danger }, label: { color: colors.textOnPrimary } },
  ghost: { container: { backgroundColor: 'transparent' }, label: { color: colors.primary } },
};

const bannerVariants: Record<BannerVariant, { container: ViewStyle; text: TextStyle }> = {
  info: { container: { backgroundColor: colors.primaryMuted }, text: { color: colors.primaryDark } },
  warning: { container: { backgroundColor: colors.warningBg }, text: { color: colors.warning } },
  danger: { container: { backgroundColor: colors.dangerBg }, text: { color: colors.danger } },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  button: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  banner: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  bannerTitle: { fontWeight: '700', marginBottom: spacing.xs },
  bannerMessage: { fontSize: 14 },
  bannerDismiss: { marginTop: spacing.sm, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: spacing.xxl },
  emptySubtitle: { marginTop: spacing.xs, textAlign: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetTitle: { textAlign: 'center', marginBottom: spacing.sm },
  sheetAction: { paddingVertical: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
});
