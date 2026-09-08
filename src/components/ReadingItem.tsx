import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Reading } from '../types';
import Swipeable from 'react-native-gesture-handler/Swipeable';

type Props = {
  reading: Reading;
  parameterDisplayName?: string;
  onDelete: (id: string) => void;
  onPress?: () => void;
};

export default function ReadingItem({ reading, parameterDisplayName, onDelete, onPress }: Props) {
  const rightActions = () => (
    <TouchableOpacity style={styles.deleteButton} onPress={() => {
      Alert.alert('Delete', 'Delete this reading?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(reading.id) }
      ]);
    }}>
      <Text style={{ color: '#fff' }}>Delete</Text>
    </TouchableOpacity>
  );

  const primaryText = parameterDisplayName ?? reading.parameter_type_id;
  const valuesText = Object.entries(reading.values).map(([k, v]) => `${k}: ${v}`).join('  ');

  return (
    <Swipeable renderRightActions={rightActions}>
      <TouchableOpacity style={styles.container} onPress={onPress}>
        <View>
          <Text style={styles.title}>{primaryText}</Text>
          <Text style={styles.subtitle}>{new Date(reading.recorded_at).toLocaleString()}</Text>
        </View>
        <View>
          <Text style={styles.values}>{valuesText}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#666', fontSize: 12 },
  values: { textAlign: 'right', color: '#222' },
  deleteButton: { backgroundColor: '#D9534F', justifyContent: 'center', alignItems: 'center', padding: 20 }
});
