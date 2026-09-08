import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { generateReportPDF } from '../services/pdf';

export default function ReportScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [filter, setFilter] = useState<string[]>([]);

  useEffect(() => { fetchParameterTypes().then(setTypes); }, []);
  useEffect(() => { if (activeProfile) fetchReadingsForProfile(activeProfile.id).then(setReadings); }, [activeProfile]);

  const handleGenerate = async () => {
    if (!activeProfile) return;
    await generateReportPDF(activeProfile, readings, filter);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18 }}>Reports</Text>
      <View style={{ marginTop: 12 }}>
        <Text style={{ marginBottom: 8 }}>Parameters</Text>
        <View style={{ flexDirection: 'row' }}>
          {types.map(t => (
            <TouchableOpacity key={t.id} onPress={() => setFilter(prev => prev.includes(t.id) ? prev.filter(x=>x!==t.id) : [...prev, t.id])} style={{ padding: 8, borderWidth: 1, borderColor: '#0077CC', marginRight: 8, backgroundColor: filter.includes(t.id) ? '#0077CC' : '#fff' }}>
              <Text style={{ color: filter.includes(t.id) ? '#fff' : '#0077CC' }}>{t.display_name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleGenerate} style={{ marginTop: 16, backgroundColor: '#0077CC', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>Generate & Share PDF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
