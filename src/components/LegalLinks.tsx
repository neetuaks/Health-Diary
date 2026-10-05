import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { openLegalUrl, LegalUrlKey } from '../config/legal';
import { colors, spacing, typography } from '../theme/tokens';

export type LegalLinkKey = Extract<LegalUrlKey, 'privacy' | 'terms' | 'disclaimer'>;

const LABELS: Record<LegalLinkKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  disclaimer: 'Medical Disclaimer',
};

const ALL_LINKS: LegalLinkKey[] = ['privacy', 'terms', 'disclaimer'];

// Reusable tappable Privacy Policy / Terms of Service / Medical Disclaimer links
// (docs/CLAUDE-CODE-PROMPT-legal-links.md §2). Used inline (row) on the first-launch
// screen and Paywall — both only want Terms + Privacy — and as a full list (all three)
// in Settings > About. Every link goes through openLegalUrl, so failure handling only
// lives in one place.
export function LegalLinks({
  links = ALL_LINKS,
  variant = 'row',
}: {
  links?: LegalLinkKey[];
  variant?: 'row' | 'list';
}) {
  return (
    <View style={variant === 'row' ? styles.row : styles.list}>
      {links.map(key => (
        <TouchableOpacity
          key={key}
          onPress={() => openLegalUrl(key)}
          activeOpacity={0.6}
          accessibilityRole="link"
          accessibilityLabel={LABELS[key]}
          style={styles.touchTarget}
        >
          <Text style={styles.link}>{LABELS[key]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  list: { flexDirection: 'column' },
  // Minimum 44x44 tap target (standard accessibility guidance) even though the
  // text itself is small — padding does the work, not font size.
  touchTarget: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, minHeight: 44, justifyContent: 'center' },
  link: { ...typography.body, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
});
