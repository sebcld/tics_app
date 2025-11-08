import { StyleSheet } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';
import Hello from '@/src/components/Hello';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hola TICS</Text>
      <Hello name="TICS" />
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
