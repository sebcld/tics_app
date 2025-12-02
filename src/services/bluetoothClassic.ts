import { log } from '@/src/utils/logger';
import { PermissionsAndroid, Platform } from 'react-native';
import RNBluetoothSerial from 'react-native-bluetooth-serial';

export type NotifyCallback = (text: string) => void;

let isConnected = false;
let notifySubscription: (() => void) | null = null;
let readingLoop: ReturnType<typeof setInterval> | null = null;
let currentDevice: any = null;

/**
 * Solicita permisos de Bluetooth en Android
 */
async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  
  try {
    const apiLevel = Platform.Version as number;
    if (apiLevel >= 31) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN || 'android.permission.BLUETOOTH_SCAN',
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT || 'android.permission.BLUETOOTH_CONNECT',
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];
      
      const granted = await PermissionsAndroid.requestMultiple(permissions as string[]);
      log('Bluetooth Classic: permission request result', JSON.stringify(granted));
      
      const allGranted = Object.values(granted).every(
        (result) => result === PermissionsAndroid.RESULTS.GRANTED
      );
      return allGranted;
    }
  } catch (e) {
    log('Bluetooth Classic: permission error', String(e));
    return false;
  }
  return true;
}

/**
 * Escanea y se conecta al primer dispositivo Backsafe encontrado
 */
export async function scanAndConnect(onFound?: (device: any) => void): Promise<any> {
  log('Bluetooth Classic: checking if enabled...');
  
  // Verificar permisos
  const hasPermissions = await ensureBluetoothPermissions();
  if (!hasPermissions) {
    throw new Error('Permisos de Bluetooth denegados');
  }
  
  // Verificar si Bluetooth está habilitado
  const isEnabled = await RNBluetoothSerial.isEnabled();
  if (!isEnabled) {
    throw new Error('Bluetooth no está habilitado');
  }
  
  log('Bluetooth Classic: scanning for devices...');
  
  // Obtener lista de dispositivos emparejados
  const pairedDevices = await RNBluetoothSerial.list();
  log('Bluetooth Classic: paired devices', JSON.stringify(pairedDevices));
  
  // Buscar dispositivo Backsafe
  const device = pairedDevices.find((d: any) => {
    const name = d.name || d.id;
    return name && (name.includes('Backsafe') || name.includes('ESP32'));
  });
  
  if (!device) {
    throw new Error('No se encontró un dispositivo Backsafe. Asegúrate de emparejar el ESP32 primero.');
  }
  
  log('Bluetooth Classic: found device', device.name, device.id);
  onFound?.(device);
  
  // Conectar al dispositivo
  await connectToDevice(device);
  
  return device;
}

/**
 * Conecta a un dispositivo Bluetooth específico
 */
export async function connectToDevice(device: any): Promise<void> {
  log('Bluetooth Classic: connecting to', device.id);
  
  try {
    await RNBluetoothSerial.connect(device.id);
    isConnected = true;
    currentDevice = device;
    log('Bluetooth Classic: connected successfully');
  } catch (e) {
    isConnected = false;
    throw new Error(`Error conectando a ${device.name}: ${String(e)}`);
  }
}

/**
 * Desconecta del dispositivo Bluetooth
 */
export async function disconnect(): Promise<void> {
  // Detener lectura en bucle
  if (readingLoop) {
    clearInterval(readingLoop);
    readingLoop = null;
  }
  
  // Remover suscripción
  if (notifySubscription) {
    try {
      notifySubscription();
    } catch {}
    notifySubscription = null;
  }
  
  // Desconectar
  if (isConnected) {
    try {
      await RNBluetoothSerial.disconnect();
      log('Bluetooth Classic: disconnected');
    } catch (e) {
      log('Bluetooth Classic: disconnect error', String(e));
    }
  }
  
  isConnected = false;
  currentDevice = null;
}

/**
 * Envía un comando al dispositivo
 */
export async function writeCommand(text: string): Promise<void> {
  if (!isConnected) {
    throw new Error('No hay dispositivo conectado');
  }
  
  try {
    await RNBluetoothSerial.write(text + '\n');
    log('Bluetooth Classic: command sent', text);
  } catch (e) {
    throw new Error(`Error enviando comando: ${String(e)}`);
  }
}

/**
 * Se suscribe a las notificaciones del dispositivo
 * Lee continuamente datos del buffer serial
 */
export async function subscribeNotifications(cb: NotifyCallback): Promise<void> {
  if (!isConnected) {
    throw new Error('No hay dispositivo conectado');
  }
  
  log('Bluetooth Classic: starting notification monitor');
  
  // Detener lectura anterior si existe
  if (readingLoop) {
    clearInterval(readingLoop);
  }
  
  // Leer datos cada 100ms
  readingLoop = setInterval(async () => {
    try {
      const availableBytes = await RNBluetoothSerial.available();
      
      if (availableBytes > 0) {
        const data = await RNBluetoothSerial.read();
        
        if (data && data.length > 0) {
          log('Bluetooth Classic: received', String(data).length, 'bytes');
          log('Bluetooth Classic: data:', String(data));
          
          // El dato puede ser múltiples líneas (múltiples comandos/notificaciones)
          // Dividir por líneas y procesar cada una
          const lines = String(data).split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              log('Bluetooth Classic: processing line:', trimmed);
              cb(trimmed);
            }
          }
        }
      }
    } catch (e) {
      log('Bluetooth Classic: read error', String(e));
    }
  }, 100);
  
  notifySubscription = () => {
    if (readingLoop) {
      clearInterval(readingLoop);
      readingLoop = null;
    }
  };
  
  log('Bluetooth Classic: notification monitor started');
}

/**
 * Conecta, se suscribe y envía comando START
 */
export async function connectAndSubscribe(cb: NotifyCallback): Promise<any> {
  const device = await scanAndConnect();
  await subscribeNotifications(cb);
  return device;
}

/**
 * Conecta, se suscribe, envía START y espera a que el dispositivo responda
 */
export async function connectSubscribeAndStart(cb: NotifyCallback): Promise<any> {
  const device = await connectAndSubscribe(cb);
  await new Promise((r) => setTimeout(r, 500));
  await writeCommand('START');
  return device;
}

export function getCurrentDevice(): any {
  return currentDevice;
}

export function isBluetoothConnected(): boolean {
  return isConnected;
}
