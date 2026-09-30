import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useProfile } from '../services/profileContext';
import { useEntitlement } from '../services/entitlement';
import { fetchFamilyDashboardData, DashboardProfileCard } from '../services/familyDashboard';
import { clinicalColorKey } from '../services/utils';
import { Screen, Card, Button, EmptyState } from '../theme/components';
import { colors, spacing, typography, radius } from '../theme/tokens';

// FAMILY-FEATURES-SPEC.md §1. Premium-only — Free/Pro see a locked upsell
// (the spec's "default: show locked with an upsell, since seeing it drives
// upgrades") rather than the tab being hidden entirely.
function LockedUpsell({ navigation }: { navigation: any }) {
  return (
    <Screen>
      <EmptyState
        title="Family Dashboard"
        subtitle="See everyone you track at a glance — latest readings, who needs attention, all on one screen. Upgrade to Premium to unlock."
      />
      <Button label="See Plans" onPress={() => navigation.navigate('Paywall')} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

function ParameterRow({ card }: { card: DashboardProfileCard['parameters'][number] }) {
  if (!card.latestReading) {
    return (
      <View style={styles.paramRow}>
        <Text style={typography.bodyBold}>{card.parameterType.display_name}</Text>
        <Text style={typography.caption}>No readings yet</Text>
      </View>
    );
  }
  return (
    <View style={[styles.paramRow, card.needsAttention && styles.paramRowAttention]}>
      <View style={{ flex: 1 }}>
        <Text style={typography.bodyBold}>{card.parameterType.display_name}</Text>
        <Text style={typography.caption}>
          {new Date(card.latestReading.recorded_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          {card.isStale ? ' · No recent reading' : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {card.values.map(v => (
          <Text
            key={v.label}
            style={[
              typography.bodyBold,
              v.classification ? { color: colors[clinicalColorKey(v.classification)] } : null,
            ]}
          >
            {v.display}{v.unit ? ` ${v.unit}` : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function FamilyDashboardScreen() {
  const { profiles, setActiveProfile } = useProfile();
  const { limits } = useEntitlement();
  const navigation = useNavigation<any>();
  const [cards, setCards] = useState<DashboardProfileCard[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!limits.familyDashboard) return;
      // Locked profiles (over the plan's profile limit — see entitlementLocks.ts)
      // aren't currently usable anywhere else in the app either, so they're left
      // out of the dashboard the same way.
      const active = profiles.filter(p => !p.locked_at);
      fetchFamilyDashboardData(active).then(setCards);
    }, [profiles, limits.familyDashboard])
  );

  if (!limits.familyDashboard) {
    return <LockedUpsell navigation={navigation} />;
  }

  const openProfile = (profileId: string) => {
    setActiveProfile(profileId);
    navigation.navigate('MainTabs', { screen: 'Diary' });
  };

  return (
    <Screen>
      <Text style={typography.h1}>Family Dashboard</Text>
      <FlatList
        style={{ marginTop: spacing.lg }}
        data={cards}
        keyExtractor={c => c.profile.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openProfile(item.profile.id)} activeOpacity={0.7}>
            <Card style={item.needsAttention ? styles.attentionCard : undefined}>
              <View style={styles.profileHeader}>
                <Text style={typography.h2}>{item.profile.name}</Text>
                {item.needsAttention && <Text style={styles.attentionBadge}>Needs attention</Text>}
              </View>
              {!item.hasAnyReadings ? (
                <Text style={[typography.caption, { marginTop: spacing.xs }]}>No readings yet</Text>
              ) : (
                item.parameters.filter(p => p.latestReading).map(p => (
                  <ParameterRow key={p.parameterType.id} card={p} />
                ))
              )}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => <EmptyState title="No profiles yet" subtitle="Add a profile to start tracking readings." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attentionCard: { borderColor: colors.warning, borderWidth: 1 },
  attentionBadge: {
    fontSize: 11, fontWeight: '700', color: colors.warning,
    backgroundColor: colors.warningBg, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.sm, overflow: 'hidden',
  },
  paramRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, marginTop: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  paramRowAttention: { backgroundColor: colors.warningBg },
});
