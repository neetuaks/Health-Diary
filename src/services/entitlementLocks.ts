import { getDB } from '../db/init';

// Non-destructive downgrade/expiry rules (PAYWALL-SPEC §7): when the tier drops
// and a profile or custom parameter type count now exceeds the new limit,
// nothing is deleted — the excess is locked (readings/definitions untouched,
// just hidden from creation/selection) and unlocked again on upgrade. Locking
// is expressed as a `locked_at` timestamp (null = active); the timestamp also
// doubles as the unlock order below, so it needs no separate column.

export type Lockable = { id: string; locked_at?: string | null };

// Pure — no DB access, so this is unit-testable on its own and reused for both
// profiles and custom parameter types. `protectedId` (e.g. the active profile)
// is kept unlocked whenever there's room for it at all, so a tier drop never
// locks out the profile the user is actively looking at. Otherwise items keep
// whichever order the caller passes (DB row order — the closest thing this
// schema has to "oldest first", since neither table has a created_at column),
// so locking is stable across repeated calls rather than shuffling every time.
export function reconcileLocks<T extends Lockable>(
  items: T[],
  limit: number,
  protectedId?: string | null
): { toLock: string[]; toUnlock: string[] } {
  const ordered = protectedId
    ? [...items.filter(i => i.id === protectedId), ...items.filter(i => i.id !== protectedId)]
    : items;

  const toLock: string[] = [];
  const toUnlock: string[] = [];
  let activeCount = 0;
  for (const item of ordered) {
    const currentlyLocked = !!item.locked_at;
    if (activeCount < Math.max(0, limit)) {
      activeCount++;
      if (currentlyLocked) toUnlock.push(item.id);
    } else if (!currentlyLocked) {
      toLock.push(item.id);
    }
  }
  return { toLock, toUnlock };
}

export async function lockProfile(id: string): Promise<void> {
  await getDB().runAsync('UPDATE profiles SET locked_at = ? WHERE id = ?;', [new Date().toISOString(), id]);
}

export async function unlockProfile(id: string): Promise<void> {
  await getDB().runAsync('UPDATE profiles SET locked_at = NULL WHERE id = ?;', [id]);
}

export async function lockParameterType(id: string): Promise<void> {
  await getDB().runAsync('UPDATE parameter_types SET locked_at = ? WHERE id = ? AND is_builtin = 0;', [new Date().toISOString(), id]);
}

export async function unlockParameterType(id: string): Promise<void> {
  await getDB().runAsync('UPDATE parameter_types SET locked_at = NULL WHERE id = ? AND is_builtin = 0;', [id]);
}

// Computes and persists in one call — the shape every screen actually wants
// (see ProfileManager / ParameterTypesScreen), so callers don't have to thread
// reconcileLocks' output through lockProfile/unlockProfile themselves.
export async function reconcileAndPersistProfileLocks(
  profiles: Lockable[],
  limit: number,
  activeProfileId?: string | null
): Promise<{ toLock: string[]; toUnlock: string[] }> {
  const result = reconcileLocks(profiles, limit, activeProfileId);
  for (const id of result.toLock) await lockProfile(id);
  for (const id of result.toUnlock) await unlockProfile(id);
  return result;
}

export async function reconcileAndPersistParameterTypeLocks(
  customTypes: Lockable[],
  limit: number
): Promise<{ toLock: string[]; toUnlock: string[] }> {
  const result = reconcileLocks(customTypes, limit);
  for (const id of result.toLock) await lockParameterType(id);
  for (const id of result.toUnlock) await unlockParameterType(id);
  return result;
}
