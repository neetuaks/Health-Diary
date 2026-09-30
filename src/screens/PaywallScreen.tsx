import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking, Platform, StyleSheet } from 'react-native';
import { useEntitlement } from '../services/entitlement';
import { getOfferings, purchasePackage, restorePurchases, PurchasesOffering, PurchasesPackageInfo } from '../services/purchases';
import { Tier, TIER_DISPLAY_NAME } from '../services/limits';
import { Screen, Card, Button } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

// Locked pricing (docs/PAYWALL-SPEC.md §2/§8) — shown whenever a live store
// offering isn't available (e.g. under Expo Go, or before RevenueCat/store
// products exist). A real device build prefers each package's own
// product.priceString instead, so regional pricing stays correct. Bare
// amounts only (no "/mo" or "/yr" suffix) — the surrounding JSX supplies the
// period label so it isn't duplicated.
const FALLBACK_PRICING: Record<'pro' | 'premium', { monthly: string; annual: string; perDay: string }> = {
  pro: { monthly: '₹149', annual: '₹1,490', perDay: '≈ ₹5/day' },
  premium: { monthly: '₹249', annual: '₹2,490', perDay: '≈ ₹8/day' },
};

const PRODUCT_ID_MAP: Record<'pro' | 'premium', { monthly: string; annual: string }> = {
  pro: { monthly: 'pro_monthly', annual: 'pro_annual' },
  premium: { monthly: 'premium_monthly', annual: 'premium_annual' },
};

function findPackage(offering: PurchasesOffering | null, productId: string): PurchasesPackageInfo | undefined {
  return offering?.availablePackages.find(p => p.product.identifier === productId);
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureCheck}>{'✓'}</Text>
      <Text style={[typography.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

// Standard subscription-card layout (App Store / Play Store convention): the
// monthly price is the big, immediate number since that's what most people
// scan for first; the annual price is a small secondary line underneath
// (framed as the savings option), then the feature list, then the CTA —
// not price buried under a bullet list, which is how this screen used to
// read.
function PlanCard({
  tier,
  badge,
  features,
  offering,
  currentTier,
  onPurchase,
  purchasing,
}: {
  tier: 'pro' | 'premium';
  badge?: string;
  features: string[];
  offering: PurchasesOffering | null;
  currentTier: Tier;
  onPurchase: (pkg: PurchasesPackageInfo | null, tier: 'pro' | 'premium', period: 'monthly' | 'annual') => void;
  purchasing: boolean;
}) {
  const annualPkg = findPackage(offering, PRODUCT_ID_MAP[tier].annual);
  const monthlyPkg = findPackage(offering, PRODUCT_ID_MAP[tier].monthly);
  const isCurrent = currentTier === tier;

  return (
    <Card style={styles.planCard}>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={typography.h2}>{TIER_DISPLAY_NAME[tier]}</Text>

      <View style={styles.priceBlock}>
        <View style={styles.priceRow}>
          <Text style={typography.numberLarge}>{monthlyPkg?.product.priceString ?? FALLBACK_PRICING[tier].monthly}</Text>
          <Text style={styles.pricePeriod}>/month</Text>
        </View>
        <Text style={styles.annualNote}>
          or {annualPkg?.product.priceString ?? FALLBACK_PRICING[tier].annual}/year ({FALLBACK_PRICING[tier].perDay})
        </Text>
      </View>

      <View style={styles.featureList}>
        {features.map(f => <FeatureRow key={f} text={f} />)}
      </View>

      {isCurrent ? (
        <View style={[styles.button, styles.currentPlanButton]}>
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Your current plan</Text>
        </View>
      ) : (
        <>
          <Button
            label={`Get ${TIER_DISPLAY_NAME[tier]}`}
            disabled={purchasing}
            onPress={() => onPurchase(monthlyPkg ?? null, tier, 'monthly')}
            style={{ marginTop: spacing.md }}
          />
          <TouchableOpacity
            disabled={purchasing}
            onPress={() => onPurchase(annualPkg ?? null, tier, 'annual')}
            style={{ marginTop: spacing.sm, alignItems: 'center' }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Switch to annual & save</Text>
          </TouchableOpacity>
        </>
      )}
    </Card>
  );
}

export default function PaywallScreen({ navigation }: any) {
  const { tier, refresh } = useEntitlement();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getOfferings().then(setOffering);
  }, []);

  const handlePurchase = async (pkg: PurchasesPackageInfo | null, planTier: 'pro' | 'premium', period: 'monthly' | 'annual') => {
    if (!pkg) {
      Alert.alert(
        'Not available yet',
        'This plan is not set up on the store yet. Please try again once it ships, or contact support.'
      );
      return;
    }
    setPurchasing(true);
    try {
      await purchasePackage(pkg);
      await refresh();
      Alert.alert('Thank you!', `You're now on ${TIER_DISPLAY_NAME[planTier]}.`);
      navigation.goBack();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      await refresh();
      if (info) Alert.alert('Restored', 'Your purchases have been restored.');
      else Alert.alert('Nothing to restore', 'No previous purchase was found for this device.');
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    const url = Platform.OS === 'ios'
      ? 'itms-apps://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url).catch(() => Alert.alert('Could not open', 'Please manage your subscription from the store app directly.'));
  };

  return (
    <Screen scroll>
      <Text style={typography.h1}>Health Diary Plans</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
        Your subscription funds ongoing improvements and keeps the app ad-free. Your health data always stays on your device.
      </Text>

      <Card style={[styles.planCard, { marginTop: spacing.lg }]}>
        <Text style={typography.h2}>Free</Text>

        <View style={styles.priceBlock}>
          <View style={styles.priceRow}>
            <Text style={typography.numberLarge}>₹0</Text>
            <Text style={styles.pricePeriod}>/month</Text>
          </View>
          <Text style={styles.annualNote}>forever — no card needed</Text>
        </View>

        <View style={styles.featureList}>
          <FeatureRow text="1 profile" />
          <FeatureRow text="Last 7 days in-app" />
          <FeatureRow text="Blood Pressure & Glucose tracking" />
        </View>

        {tier === 'free' && (
          <View style={[styles.button, styles.currentPlanButton, { marginTop: spacing.md }]}>
            <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Your current plan</Text>
          </View>
        )}
      </Card>

      <PlanCard
        tier="pro"
        features={['2 profiles', 'Full history', 'Blood Pressure & Glucose + up to 4 custom parameters', 'Download PDF reports']}
        offering={offering}
        currentTier={tier}
        onPurchase={handlePurchase}
        purchasing={purchasing}
      />

      <PlanCard
        tier="premium"
        badge="Most popular for families"
        features={['10 profiles', 'Blood Pressure & Glucose + up to 8 custom parameters', 'Full family history', 'Family dashboard', 'Consolidated report']}
        offering={offering}
        currentTier={tier}
        onPurchase={handlePurchase}
        purchasing={purchasing}
      />

      <TouchableOpacity onPress={handleRestore} disabled={restoring} style={{ marginTop: spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
      </TouchableOpacity>

      {tier !== 'free' && (
        <TouchableOpacity onPress={handleManageSubscription} style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Manage Subscription</Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planCard: { marginTop: spacing.lg, position: 'relative' },
  badge: {
    position: 'absolute', top: -10, right: spacing.lg,
    backgroundColor: colors.secondary, borderRadius: radius.pill,
    paddingVertical: 4, paddingHorizontal: spacing.sm,
  },
  badgeText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: '700' },
  priceBlock: { marginTop: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  pricePeriod: { ...typography.body, color: colors.textMuted, marginLeft: 4, marginBottom: 4 },
  annualNote: { ...typography.caption, marginTop: 2 },
  featureList: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xs, gap: spacing.xs },
  featureCheck: { color: colors.success, fontWeight: '700', width: 18 },
  button: { paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  currentPlanButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
});
