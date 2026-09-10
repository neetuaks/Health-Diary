import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useProfile } from '../services/profileContext';
import { fetchReadingsForProfile } from '../services/readingService';
import { fetchParameterTypes } from '../services/parameterRegistry';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryLegend } from 'victory-native';
import { filterByRange, RangeKey } from '../services/utils';

export default function ChartScreen() {
  const { activeProfile } = useProfile();
  const [readings, setReadings] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('7');

  useEffect(() => { fetchParameterTypes().then(setTypes); }, []);
  useEffect(() => {
    if (!activeProfile) return;
    fetchReadingsForProfile(activeProfile.id).then(rs => setReadings(rs));
  }, [activeProfile]);

  const filtered = selectedType ? filterByRange(readings.filter(r => r.parameter_type_id === selectedType), range) : [];

  const series = (key: string) => filtered.map(r => ({ x: new Date(r.recorded_at), y: Number(r.values[key]) }));

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18 }}>Charts</Text>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {types.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setSelectedType(t.id)} style={[styles.typeBtn, selectedType === t.id && styles.typeBtnActive]}>
            <Text style={{ color: selectedType === t.id ? '#fff' : '#0077CC' }}>{t.display_name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        {['today','yesterday','7','30'].map(rk => (
          <TouchableOpacity key={rk} onPress={() => setRange(rk as RangeKey)} style={[styles.rangeBtn, range === rk && styles.rangeBtnActive]}>
            <Text style={{ color: range === rk ? '#fff' : '#0077CC' }}>{rk === '7' ? 'Last 7 Days' : rk === '30' ? 'Last 30 Days' : rk === 'today' ? 'Today' : 'Yesterday'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedType && (
        <View style={{ marginTop: 18 }}>
          {/* For BP: show systolic & diastolic lines if available */}
          {(() => {
            const typeDef = types.find(t => t.id === selectedType);
            if (!typeDef) return null;
            const fields = typeDef.field_definitions;
            const numericFields = fields.filter((f:any) => f.dataType === 'numeric');
            return (
              <VictoryChart>
                {numericFields.map((f:any, idx:number) => (
                  <VictoryLine key={f.key} data={series(f.key)} interpolation="monotoneX" />
                ))}
                <VictoryAxis dependentAxis />
                <VictoryAxis fixLabelOverlap />
              </VictoryChart>
            );
          })()}

          <View style={{ marginTop: 12 }}>
            <Text>Summary</Text>
            {/* compute avg/min/max */}
            {(() => {
              const typeDef = types.find(t => t.id === selectedType);
              if (!typeDef) return null;
              const numericFields = typeDef.field_definitions.filter((f:any) => f.dataType === 'numeric');
              return numericFields.map((f:any) => {
                const vals = filtered.map(r => Number(r.values[f.key])).filter(v => !isNaN(v));
                if (vals.length === 0) return <Text key={f.key}>{f.label}: no data</Text>;
                const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                return <Text key={f.key}>{f.label}: avg {avg} min {min} max {max} ({vals.length} readings)</Text>;
              });
            })()}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  typeBtn: { padding: 8, borderWidth: 1, borderColor: '#0077CC', borderRadius: 6, marginRight: 8 },
  typeBtnActive: { backgroundColor: '#0077CC' },
  rangeBtn: { padding: 6, borderWidth: 1, borderColor: '#0077CC', borderRadius: 6, marginRight: 8 },
  rangeBtnActive: { backgroundColor: '#0077CC' }
});
