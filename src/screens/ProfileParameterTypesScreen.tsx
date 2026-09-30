import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ParameterType } from '../types';
import { fetchParameterTypes } from '../services/parameterRegistry';
import {
  fetchProfileParameterTypeIds,
  addParameterTypeToProfile,
  removeParameterTypeFromProfile
} from '../services/profileParameterTypes';
import { Screen, Card, Button, EmptyState } from '../theme/components';
import { colors, spacing, typography } from '../theme/tokens';

export default function ProfileParameterTypesScreen({ route }: any) {
  const { profileId, profileName } = route.params as { profileId: string; profileName: string };
  const [builtins, setBuiltins] = useState<ParameterType[]>([]);
  const [custom, setCustom] = useState<ParameterType[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());

  const refresh = () => {
    fetchParameterTypes().then(all => {
      setBuiltins(all.filter(t => !!t.is_builtin));
      setCustom(all.filter(t => !t.is_builtin));
    });
    fetchProfileParameterTypeIds(profileId).then(setEnabledIds);
  };

  useEffect(() => {
    refresh();
  }, [profileId]);

  const toggle = async (pt: ParameterType) => {
    if (enabledIds.has(pt.id)) {
      await removeParameterTypeFromProfile(profileId, pt.id);
    } else {
      await addParameterTypeToProfile(profileId, pt.id);
    }
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(pt.id)) next.delete(pt.id); else next.add(pt.id);
      return next;
    });
  };

  return (
    <Screen>
      <Text style={typography.h1}>Parameters for {profileName}</Text>
      <Text style={[typography.caption, { marginTop: spacing.xs }]}>
        Choose which custom parameter types show up for this profile. Built-in types are always included.
      </Text>

      {builtins.length > 0 && (
        <>
          <Text style={[typography.bodyBold, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>Always included</Text>
          {builtins.map(pt => (
            <Card key={pt.id} style={{ marginTop: spacing.sm, opacity: 0.7 }}>
              <Text style={typography.bodyBold}>{pt.display_name}</Text>
              <Text style={typography.caption}>Built-in</Text>
            </Card>
          ))}
        </>
      )}

      <Text style={[typography.bodyBold, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>Custom parameters</Text>
      <FlatList
        data={custom}
        keyExtractor={t => t.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const enabled = enabledIds.has(item.id);
          return (
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyBold}>{item.display_name}</Text>
                <Text style={typography.caption}>{enabled ? 'Added to this profile' : 'Not added to this profile'}</Text>
              </View>
              <Button
                label={enabled ? 'Remove' : 'Add'}
                size="sm"
                variant={enabled ? 'destructive' : 'secondary'}
                onPress={() => toggle(item)}
              />
            </Card>
          );
        }}
        ListEmptyComponent={() => <EmptyState title="No custom parameter types yet" subtitle="Create one from Settings > Manage Parameter Types." />}
      />
    </Screen>
  );
}
