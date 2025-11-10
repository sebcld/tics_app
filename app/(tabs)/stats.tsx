import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

type DailyReport = {
  date: string;
  duration: number;
  okSeconds: number;
  alertSeconds: number;
  alerts: number;
};

export default function StatsScreen() {
  const [reports, setReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    // Placeholder: carga de datos simulados
    setReports([
      { date: '2025-11-08', duration: 3600, okSeconds: 2900, alertSeconds: 700, alerts: 5 },
      { date: '2025-11-07', duration: 4200, okSeconds: 3500, alertSeconds: 700, alerts: 4 },
    ]);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Estadísticas</Text>
      {reports.map((r) => (
        <View key={r.date} style={styles.card}>
          <Text style={styles.date}>{r.date}</Text>
          <Text>Total (min): {(r.duration / 60).toFixed(0)}</Text>
          <Text>Correcta (min): {(r.okSeconds / 60).toFixed(0)}</Text>
          <Text>Incorrecta (min): {(r.alertSeconds / 60).toFixed(0)}</Text>
          <Text>Alertas: {r.alerts}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  date: { fontWeight: 'bold' },
});

