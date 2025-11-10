import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useBacksafe } from '@/src/context/BacksafeContext';

export default function MonitorScreen() {
  const { posture, angle, alertActive } = useBacksafe();
  const ok = posture === 'ok' && !alertActive;
  const color = posture === 'alert' || alertActive ? '#ff4d4d' : ok ? '#2ecc71' : '#999';
  const text = posture === 'alert' || alertActive ? '¡Corrige tu postura!' : ok ? 'Postura Correcta' : 'Monitoreo';

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { backgroundColor: color }]} />
      <Text style={styles.title}>{text}</Text>
      {typeof angle === 'number' && (
        <Text style={styles.subtitle}>Ángulo actual: {angle.toFixed(1)}°</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
  },
});
