import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { processImageForReading } from '../services/ocr';
import NewRecordModal from './NewRecordModal';

export default function PhotoEntryModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const pick = async (fromCamera = false) => {
    try {
      setBusy(true);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take a photo');
        setBusy(false);
        return;
      }
      const res = fromCamera ? await ImagePicker.launchCameraAsync({ quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled || !res.assets || res.assets.length === 0) { setBusy(false); return; }
      const uri = res.assets[0].uri;
      const ocr = await processImageForReading(uri);
      // Always show confirmation edit form with prefilled values
      setPrefill({ parameter_type_id: ocr.parameterType === 'bp' ? 'bp' : 'glucose', values: ocr.values, source: 'photo' });
      setModalOpen(true);
    } catch (e) {
      Alert.alert('OCR failed', String(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Photo OCR Entry</Text>
        <View style={{ marginTop: 12 }}>
          <TouchableOpacity onPress={() => pick(true)} style={{ padding: 12, backgroundColor: '#0077CC', borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pick(false)} style={{ padding: 12, marginTop: 8 }}>
            <Text>Choose From Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ padding: 12, marginTop: 8 }}>
            <Text>Cancel</Text>
          </TouchableOpacity>
        </View>

        {busy && <ActivityIndicator style={{ marginTop: 20 }} />}

        {modalOpen && prefill && (
          <NewRecordModal visible={modalOpen} initialValues={prefill} onClose={() => { setModalOpen(false); setPrefill(null); onClose(); }} onSaved={() => { onSaved && onSaved(); setModalOpen(false); setPrefill(null); }} editingReading={null} />
        )}
      </View>
    </Modal>
  );
}
