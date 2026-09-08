import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';

export default function RestoreOptionsModal({ visible, onClose, onChoose }: { visible: boolean; onClose: () => void; onChoose: (choice: 'merge' | 'replace') => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ width: '90%', backgroundColor: '#fff', padding: 16, borderRadius: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Restore Options</Text>
          <Text style={{ marginTop: 8 }}>Conflicts detected with existing data. Choose how to restore:</Text>
          <TouchableOpacity onPress={() => onChoose('merge')} style={{ marginTop: 12, padding: 12, backgroundColor: '#0077CC', borderRadius: 6 }}><Text style={{ color: '#fff' }}>Merge (keep existing, add/replace by id)</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onChoose('replace')} style={{ marginTop: 8, padding: 12, backgroundColor: '#D9534F', borderRadius: 6 }}><Text style={{ color: '#fff' }}>Replace (delete existing and restore)</Text></TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 8, padding: 12 }}><Text>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
