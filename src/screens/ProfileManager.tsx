import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useProfile } from '../services/profileContext';
import { v4 as uuidv4 } from 'uuid';

export default function ProfileManager({ navigation }: any) {
  const { profiles, addProfile, setActiveProfile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name) return Alert.alert('Name required');
    await addProfile({ name });
    setModalOpen(false);
    setName('');
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Profiles</Text>
      <FlatList data={profiles} keyExtractor={p => p.id} renderItem={({ item }) => (
        <TouchableOpacity onPress={() => { setActiveProfile(item.id); navigation.goBack(); }} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <Text style={{ fontSize: 16 }}>{item.name}</Text>
          <Text style={{ color: '#666' }}>{item.date_of_birth ?? ''}</Text>
        </TouchableOpacity>
      )} ListEmptyComponent={() => (
        <View style={{ marginTop: 20 }}><Text>No profiles yet</Text></View>
      )} />

      <TouchableOpacity onPress={() => setModalOpen(true)} style={{ marginTop: 12, backgroundColor: '#0077CC', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: '#fff' }}>Add Profile</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide">
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 18 }}>New Profile</Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, marginTop: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={{ padding: 12 }}><Text>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={create} style={{ padding: 12, backgroundColor: '#0077CC', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Create</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
