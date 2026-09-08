import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Profile } from '../types';
import { getDB } from '../db/init';

type ProfileContextType = {
  profiles: Profile[];
  activeProfile?: Profile | null;
  addProfile: (p: Partial<Profile>) => Promise<Profile>;
  setActiveProfile: (id: string | null) => void;
  editProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType>({
  profiles: [],
  addProfile: async () => { throw new Error('uninitialized'); },
  setActiveProfile: () => {}
});

export default function ProfileContextProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    const db = getDB();
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM profiles;', [], (_, res) => {
        const rows = res.rows._array as Profile[];
        setProfiles(rows);
        if (rows.length > 0 && !activeProfileId) {
          setActiveProfileId(rows[0].id);
        }
      });
    });
  }, []);

  const addProfile = async (p: Partial<Profile>) => {
    const id = uuidv4();
    const profile: Profile = {
      id,
      name: p.name ?? 'New Profile',
      date_of_birth: p.date_of_birth ?? null,
      glucose_unit_pref: p.glucose_unit_pref ?? 'mg/dL',
      weight_unit_pref: p.weight_unit_pref ?? 'kg',
      last_backup_at: null
    };
    const db = getDB();
    db.transaction(tx => {
      tx.executeSql('INSERT INTO profiles (id, name, date_of_birth, glucose_unit_pref, weight_unit_pref, last_backup_at) VALUES (?,?,?,?,?,?);',
        [profile.id, profile.name, profile.date_of_birth, profile.glucose_unit_pref, profile.weight_unit_pref, profile.last_backup_at]);
    }, err => console.error(err), () => {
      setProfiles(prev => [profile, ...prev]);
      setActiveProfileId(profile.id);
    });
    return profile;
  };

  const editProfile = async (id: string, updates: Partial<Profile>) => {
    const db = getDB();
    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql('UPDATE profiles SET name = ?, date_of_birth = ?, glucose_unit_pref = ?, weight_unit_pref = ? WHERE id = ?;', [updates.name, updates.date_of_birth ?? null, updates.glucose_unit_pref ?? 'mg/dL', updates.weight_unit_pref ?? 'kg', id]);
      }, err => reject(err), () => resolve());
    });
    setProfiles(prev => prev.map(pp => pp.id === id ? { ...pp, ...updates } as Profile : pp));
  };

  const deleteProfile = async (id: string) => {
    const db = getDB();
    await new Promise<void>((resolve, reject) => {
      db.transaction(tx => {
        tx.executeSql('DELETE FROM readings WHERE profile_id = ?;', [id]);
        tx.executeSql('DELETE FROM profiles WHERE id = ?;', [id]);
      }, err => reject(err), () => resolve());
    });
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  };

  const setActiveProfile = (id: string | null) => {
    setActiveProfileId(id);
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? null;

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, addProfile, setActiveProfile, editProfile, deleteProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileActions() {
  return useContext(ProfileContext) as ProfileContextType;
}

export function useProfile() {
  return useContext(ProfileContext);
}
