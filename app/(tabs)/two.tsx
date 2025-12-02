import { Text, View } from '@/components/Themed';
import { useBacksafe } from '@/src/context/BacksafeContext';
import { StyleSheet } from 'react-native';

export default function MonitorScreen() {
  const { posture, angle, alertActive } = useBacksafe();
  const ok = posture === 'ok' && !alertActive;
  const color = posture === 'alert' || alertActive ? '#ff4d4d' : ok ? '#2ecc71' : '#999';
  const text = posture === 'alert' || alertActive ? '¡Corrige tu postura!' : ok ? 'Postura Correcta' : 'Monitoreo';

  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No conectado</Text>
        <Text style={styles.subtitle}>Conecta tu dispositivo Backsafe para comenzar</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={[styles.circle, { backgroundColor: color }]} />
        <Text style={styles.title}>{text}</Text>
        
        {/* Estado de la zona */}
        {zoneStatus && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Estado de Postura:</Text>
            <Text style={styles.infoValue}>{translateZoneStatus(zoneStatus)}</Text>
          </View>
        )}
        
        {/* Ángulo */}
        {typeof angle === 'number' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Ángulo:</Text>
            <Text style={styles.infoValue}>{angle.toFixed(1)}°</Text>
          </View>
        )}
        
        {/* Información de ocupación */}
        {typeof occupied === 'boolean' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Ocupación:</Text>
            <Text style={styles.infoValue}>{occupied ? 'Silla ocupada' : 'Silla vacía'}</Text>
          </View>
        )}
        
        {/* Suma de sensores del asiento */}
        {typeof seatSum === 'number' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Presión Asiento:</Text>
            <Text style={styles.infoValue}>{seatSum} unidades</Text>
          </View>
        )}
        
        {/* Suma de sensores del respaldo */}
        {typeof backSum === 'number' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Presión Respaldo:</Text>
            <Text style={styles.infoValue}>{backSum} unidades</Text>
          </View>
        )}
        
        {/* Valores de sensores individuales */}
        {Array.isArray(values) && values.length > 0 && (
          <View style={styles.sensorsCard}>
            <Text style={styles.sensorsTitle}>Sensores Individuales:</Text>
            <View style={styles.sensorsGrid}>
              {values.map((val, idx) => (
                <View key={idx} style={styles.sensorItem}>
                  <Text style={styles.sensorLabel}>S{idx + 1}</Text>
                  <Text style={styles.sensorValue}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Información de alerta */}
        {(alertActive || posture === 'alert') && (
          <View style={[styles.alertCard, { backgroundColor: '#fff3cd' }]}>
            <Text style={styles.alertText}>⚠️ Alerta Activa</Text>
            <Text style={styles.alertSubtext}>
              Por favor, ajusta tu postura para una posición más saludable
            </Text>
          </View>
        )}
        
        {/* Panel de Debug - Muestra valores actuales */}
        {lastEvent && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>📊 Estado Actual (Debug)</Text>
            <Text style={styles.debugText}>Notificaciones recibidas: {notificationCount}</Text>
            <Text style={styles.debugText}>Posture: {posture} (type: {typeof posture})</Text>
            <Text style={styles.debugText}>Alert Active: {String(alertActive)} (type: {typeof alertActive})</Text>
            <Text style={styles.debugText}>Zone Status: {zoneStatus || 'N/A'}</Text>
            <Text style={styles.debugText}>Status del JSON: {lastEvent.status || 'N/A'} (type: {typeof lastEvent.status})</Text>
            <Text style={styles.debugText}>Alert del JSON: {String(lastEvent.alert ?? 'N/A')} (type: {typeof lastEvent.alert})</Text>
            <Text style={styles.debugText}>ZoneAlert del JSON: {String(lastEvent.zoneAlert ?? 'N/A')} (type: {typeof lastEvent.zoneAlert})</Text>
            <Text style={styles.debugText}>Timestamp: {lastEvent.ts || 'N/A'}</Text>
            <Text style={[styles.debugText, { fontSize: 10, marginTop: 4 }]}>
              Raw (first 300 chars): {lastEvent.rawPayload?.substring(0, 300) || 'N/A'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
