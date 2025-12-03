import { StyleSheet } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';
import Hello from '@/src/components/Hello';
import { useBacksafe } from '@/src/context/BacksafeContext';
import { Button } from 'react-native';

export default function TabOneScreen() {
  const { connecting, connected, statusText, connect, calibrate, calibratePosture, startMonitoring, stopMonitoring, disconnect } = useBacksafe();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hola Usuario</Text>
      <Hello name="Usuario #" />
      <Text style={{ marginTop: 8 }}>{statusText}</Text>

      {!connected ? (
        <Button title={connecting ? 'Conectando...' : 'Conectar Backsafe'} onPress={connect} disabled={connecting} />
      ) : (
        <View style={{ gap: 8, width: '100%', marginTop: 12 }}>
          <Button title="Calibrar Baseline (vacío)" onPress={calibrate} />
          <Button title="Calibrar Postura Correcta" onPress={calibratePosture} color="#4CAF50" />
          <Button title="Iniciar Monitoreo" onPress={startMonitoring} />
          <Button title="Detener Monitoreo" onPress={stopMonitoring} />
          <Button title="Desconectar" color="#cc3333" onPress={disconnect} />
        </View>
      )}
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
