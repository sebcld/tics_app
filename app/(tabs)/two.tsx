import { Text, View } from '@/components/Themed';
import { useBacksafe } from '@/src/context/BacksafeContext';
import { ScrollView, StyleSheet } from 'react-native';

export default function MonitorScreen() {
  const {
    connected,
    posture,
    angle,
    alertActive,
    statusText,
    zoneStatus,
    sensorValues,
    seatSum,
    backSum,
  } = useBacksafe();

  const ok = posture === 'ok' && !alertActive;
  const color =
    posture === 'alert' || alertActive ? '#ff4d4d' : ok ? '#2ecc71' : '#999';
  const text =
    posture === 'alert' || alertActive
      ? 'Corrige tu postura'
      : ok
      ? 'Postura correcta'
      : 'Monitoreo';
  const detail = zoneStatus && zoneStatus.trim().length > 0 ? zoneStatus.trim() : undefined;
  const postureLabel =
    posture === 'ok'
      ? detail
        ? `Postura correcta: ${detail}`
        : 'Postura correcta'
      : detail || posture;

  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No conectado</Text>
        <Text style={styles.subtitle}>
          {statusText || 'Conecta tu dispositivo Backsafe para comenzar'}
        </Text>
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
          <Text style={styles.infoValueStrong}>{postureLabel}</Text>
        </View>

        {detail && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Posición actual:</Text>
            <Text style={styles.infoValueStrong}>{detail}</Text>
          </View>
        )}

        {typeof angle === 'number' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Angulo aproximado:</Text>
            <Text style={styles.infoValue}>{angle.toFixed(1)}°</Text>
          </View>
        )}

        {(alertActive || posture === 'alert') && (
          <View style={[styles.infoCard, styles.alertCard]}>
            <Text style={styles.alertText}>Alerta activa</Text>
            <Text style={styles.alertSubtext}>
              {detail ? `Corrige postura: ${detail}` : 'Ajusta tu postura para evitar molestias'}
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Sensores (en vivo)</Text>
          <View style={styles.sumsRow}>
            <Text style={styles.infoValueSmall}>
              Seat sum: {typeof seatSum === 'number' ? seatSum : 'N/D'}
            </Text>
            <Text style={styles.infoValueSmall}>
              Back sum: {typeof backSum === 'number' ? backSum : 'N/D'}
            </Text>
          </View>

          <Text style={[styles.infoLabel, styles.sectionTitle]}>
            Mapa de sensores
          </Text>

          {/* BLOQUE UNICO CON DISPOSICIÓN DEL ASIENTO */}

          <View style={styles.block}>
            {/* RESPALDO - FILA SUPERIOR: C5 C3 C0 */}
            <View style={styles.row}>
              {['C5', 'C3', 'C0'].map((lbl) => (
                <SensorBox
                  key={lbl}
                  label={lbl}
                  value={sensorValues[labelToIndex(lbl)]}
                />
              ))}
            </View>

            <View style={styles.rowSpacer} />

            {/* RESPALDO - FILA INFERIOR: C4 C2 C1 */}
            <View style={styles.row}>
              {['C4', 'C2', 'C1'].map((lbl) => (
                <SensorBox
                  key={lbl}
                  label={lbl}
                  value={sensorValues[labelToIndex(lbl)]}
                />
              ))}
            </View>

            {/* SEPARACIÓN VISUAL ENTRE RESPALDO Y RODILLAS */}
            <View style={styles.sectionSeparator} />

            {/* RODILLAS - FILA SUPERIOR: C8  [VACÍO]  C7 */}
            <View style={styles.row}>
              <SensorBox
                label="C8"
                value={sensorValues[labelToIndex('C8')]}
              />
              <View style={styles.cellEmpty} />
              <SensorBox
                label="C7"
                value={sensorValues[labelToIndex('C7')]}
              />
            </View>

            <View style={styles.rowSpacer} />

            {/* RODILLAS - FILA INFERIOR: C9  [VACÍO]  C6 */}
            <View style={styles.row}>
              <SensorBox
                label="C9"
                value={sensorValues[labelToIndex('C9')]}
              />
              <View style={styles.cellEmpty} />
              <SensorBox
                label="C6"
                value={sensorValues[labelToIndex('C6')]}
              />
            </View>
          </View>

          {sensorValues.length === 0 && (
            <Text style={styles.infoLabel}>Sin datos recibidos aún</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function labelToIndex(label: string): number {
  const num = Number(label.replace(/[^0-9]/g, ''));
  return Number.isFinite(num) ? num : -1;
}

function SensorBox({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>
        {typeof value === 'number' ? value : '—'}
      </Text>
    </View>
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
  infoValueStrong: {
    fontSize: 18,
    fontWeight: '800',
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
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    backgroundColor: '#fafafa',
  },
  sectionSeparator: {
    height: 14, // separación entre las “líneas” horizontales
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowSpacer: {
    height: 8,
  },
  cell: {
    width: '30%',          // 3 columnas por fila
    minWidth: 80,          // bloques un poco más grandes
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Celda vacía para que quede el hueco del medio en las rodillas
  cellEmpty: {
    width: '30%',
    minWidth: 80,
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
  sectionTitle: {
    marginTop: 8,
  },
});
