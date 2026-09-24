import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { processImageForReading } from '../services/ocr';
import NewRecordModal from './NewRecordModal';
import { Screen, Button } from '../theme/components';
import { colors, spacing, typography } from '../theme/tokens';

// Below this, we don't trust the OCR guess enough to pick a parameter type or
// prefill fields — the spec requires low-confidence results to stay blank and
// flagged, never guessed.
const LOW_CONFIDENCE_THRESHOLD = 0.5;

export default function PhotoEntryModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const pick = async (fromCamera = false) => {
    try {
      setBusy(true);
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', fromCamera ? 'Camera permission is required to take a photo' : 'Photo library permission is required to choose a photo');
        setBusy(false);
        return;
      }
      // allowsEditing shows the OS crop step so the user can frame just the
      // display — a tight crop gives OCR much larger, cleaner digits.
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: true });
      if (res.canceled || !res.assets || res.assets.length === 0) { setBusy(false); return; }
      const uri = res.assets[0].uri;
      // The photo itself is never persisted anywhere by this app — it's read
      // once for OCR and the uri is dropped once this function returns.
      const ocr = await processImageForReading(uri);

      if (ocr.parameterType === 'unknown' || ocr.confidence < LOW_CONFIDENCE_THRESHOLD) {
        setPrefill({ parameter_type_id: undefined, vals: {}, source: 'photo', confidence: ocr.confidence, lowConfidence: true });
      } else {
        setPrefill({ parameter_type_id: ocr.parameterType, vals: ocr.values, source: 'photo', confidence: ocr.confidence });
      }
      setModalOpen(true);
    } catch (e) {
      Alert.alert('OCR failed', String(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <Screen>
        <Text style={typography.h1}>Photo OCR Entry</Text>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button label="Take Photo" onPress={() => pick(true)} />
          <Button label="Choose From Gallery" variant="secondary" onPress={() => pick(false)} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>

        {busy && <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />}

        {modalOpen && prefill && (
          <NewRecordModal visible={modalOpen} initialValues={prefill} onClose={() => { setModalOpen(false); setPrefill(null); onClose(); }} onSaved={() => { onSaved && onSaved(); setModalOpen(false); setPrefill(null); }} editingReading={null} />
        )}
      </Screen>
    </Modal>
  );
}
