import { ScrollView, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useBacksafe } from '@/src/context/BacksafeContext';

export default function MonitorScreen() {
  const { connected, posture, angle, alertActive, statusText, sensorValues, seatSum, backSum } = useBacksafe();
  const ok = posture === 'ok' && !alertActive;
  const color = posture === 'alert' || alertActive ? '#ff4d4d' : ok ? '#2ecc71' : '#999';
  const text = posture === 'alert' || alertActive ? 'Corrige tu postura' : ok ? 'Postura correcta' : 'Monitoreo';

  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No conectado</Text>
        <Text style={styles.subtitle}>{statusText || 'Conecta tu dispositivo Backsafe para comenzar'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={[styles.circle, { backgroundColor: color }]} />
        <Text style={styles.title}>{text}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Estado:</Text>
          <Text style={styles.infoValue}>{posture}</Text>
        </View>

        {typeof angle === 'number' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Angulo aproximado:</Text>
            <Text style={styles.infoValue}>{angle.toFixed(1)}°</Text>
          </View>
        )}

        {(alertActive || posture === 'alert') && (
          <View style={[styles.infoCard, styles.alertCard]}>
            <Text style={styles.alertText}>Alerta activa</Text>
            <Text style={styles.alertSubtext}>Ajusta tu postura para evitar molestias</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Sensores (en vivo)</Text>
          <View style={styles.sumsRow}>
            <Text style={styles.infoValueSmall}>Seat sum: {typeof seatSum === 'number' ? seatSum : 'N/D'}</Text>
            <Text style={styles.infoValueSmall}>Back sum: {typeof backSum === 'number' ? backSum : 'N/D'}</Text>
          </View>
          <View style={styles.grid}>
            {(sensorValues || []).map((val, idx) => (
              <View key={idx} style={styles.cell}>
                <Text style={styles.cellLabel}>S{idx + 1}</Text>
                <Text style={styles.cellValue}>{val}</Text>
              </View>
            ))}
            {sensorValues.length === 0 && <Text style={styles.infoLabel}>Sin datos recibidos aún</Text>}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoValueSmall: {
    fontSize: 14,
    fontWeight: '500',
  },
  alertCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#f0c36d',
  },
  alertText: {
    fontWeight: '700',
    color: '#c47f00',
  },
  alertSubtext: {
    fontSize: 14,
    color: '#c47f00',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  cell: {
    width: '22%',
    minWidth: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
  },
  cellLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  cellValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sumsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
});
