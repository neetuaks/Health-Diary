import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { deleteAllData } from '../services/dataManager';

export default function ConfirmDeleteAllModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [text, setText] = useState('');

  const confirm = async () => {
    if (text !== 'DELETE') return Alert.alert('Type DELETE to confirm');
    await deleteAllData();
    Alert.alert('All data deleted');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Delete All Data</Text>
        <Text style={{ marginTop: 12 }}>This will permanently delete ALL profiles and readings. Type DELETE to confirm.</Text>
        <TextInput value={text} onChangeText={setText} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, marginTop: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 12 }}><Text>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={confirm} style={{ padding: 12, backgroundColor: '#D9534F', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Delete</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
