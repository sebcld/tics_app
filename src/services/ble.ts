import {
    CHAR_COMMAND_UUID,
    CHAR_NOTIFY_UUID,
    DEVICE_NAME_PREFIX,
    SERVICE_UUID,
} from '@/src/services/backsafeProtocol';
import { log } from '@/src/utils/logger';
import { decode as b64decode, encode as b64encode } from 'base-64';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';

const manager = new BleManager();

export type BleConnection = {
  device?: Device | null;
  connected: boolean;
};

export type NotifyCallback = (text: string) => void;

let currentDevice: Device | null = null;
let notifySubscription: (() => void) | null = null;

export async function scanAndConnect(onFound?: (device: Device) => void): Promise<Device> {
  return new Promise((resolve, reject) => {
    const sub = manager.onStateChange(async (state) => {
      if (state === 'PoweredOn') {
        sub.remove();
        try {
          // Ensure required permissions on Android before scanning
          if (Platform.OS === 'android') {
            const ok = await ensureAndroidBlePermissions();
            if (!ok) return reject(new Error('Permisos BLE no concedidos'));
          }

          const device = await scanFirstMatching(onFound);
          const connected = await connectToDevice(device);
          resolve(connected);
        } catch (e) {
          reject(e);
        }
      }
    }, true);
  });
}

async function ensureAndroidBlePermissions(): Promise<boolean> {
  try {
    // Android 12+ (API 31) requires new BLUETOOTH_* runtime permissions
    const apiLevel = Platform.Version as number;
    if (apiLevel >= 31) {
      // On some RN versions PermissionsAndroid.PERMISSIONS may not include the new constants,
      // so we fall back to the string names used in the manifest.
      const permScan = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN || 'android.permission.BLUETOOTH_SCAN';
      const permConnect = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT || 'android.permission.BLUETOOTH_CONNECT';
      const permAdvertise = PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE || 'android.permission.BLUETOOTH_ADVERTISE';
      const permLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

      const requested = [permScan, permConnect, permAdvertise, permLocation];
      const granted = await PermissionsAndroid.requestMultiple(requested as string[]);
      log('BLE: permission request result', JSON.stringify(granted));

      // Determine which permissions are strictly required for scanning/connecting.
      // Advertising (permAdvertise) is optional for a central (client) app.
      const required: string[] = [];
      required.push(permScan);
      required.push(permConnect);
      // On some devices/location policies, ACCESS_FINE_LOCATION may still be required
      // for BLE scanning (older Android). We'll accept it if present but not require it
      // when API >= 31 and BLUETOOTH_SCAN/CONNECT are granted.

      // Evaluate results: consider GRANTED only for required perms
      const missing: string[] = [];
      for (const p of required) {
        const res = (granted as any)[p];
        if (res !== PermissionsAndroid.RESULTS.GRANTED) {
          missing.push(p);
        }
      }

      // If required permissions missing, attempt individual checks to gather more info
      if (missing.length > 0) {
        const checkResults: Record<string, boolean> = {};
        for (const p of [...required, permAdvertise, permLocation]) {
          try {
            // @ts-ignore
            const has = await PermissionsAndroid.check(p);
            checkResults[p] = !!has;
          } catch (e) {
            checkResults[p] = false;
          }
        }
        log('BLE: permission check results', JSON.stringify(checkResults));
      }

      const ok = missing.length === 0;
      if (!ok) log('BLE: missing required permissions', JSON.stringify(missing));
      return ok;
    } else {
      // Pre-Android 12: request location permission required for BLE scan
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permiso de ubicación requerido',
          message: 'Se requiere permiso de ubicación para escanear dispositivos Bluetooth',
          buttonNeutral: 'Preguntar luego',
          buttonNegative: 'Cancelar',
          buttonPositive: 'OK',
        }
      );
      log('BLE: location permission result', granted);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (e) {
    return false;
  }
}

async function scanFirstMatching(onFound?: (device: Device) => void): Promise<Device> {
  return new Promise((resolve, reject) => {
    log('BLE: scanning for devices...');
    let finished = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (cb?: () => void) => {
      if (finished) return;
      finished = true;
      try {
        manager.stopDeviceScan();
      } catch (e) {}
      if (timeoutId) {
        clearTimeout(timeoutId as any);
        timeoutId = null;
      }
      if (cb) cb();
    };

    manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
      if (error) {
        finish(() => reject(error));
        return;
      }
      if (!device) return;
      if (
        (device.name && device.name.startsWith(DEVICE_NAME_PREFIX)) ||
        (device.localName && device.localName.startsWith(DEVICE_NAME_PREFIX))
      ) {
        log('BLE: found', device.name || device.localName, device.id);
        onFound?.(device);
        finish(() => resolve(device));
      }
    });

    // Fallback timeout
    timeoutId = setTimeout(() => {
      finish(() => reject(new Error('No se encontró un dispositivo Backsafe por BLE')));
    }, 20000);
  });
}

export async function connectToDevice(device: Device): Promise<Device> {
  log('BLE: connecting to', device.id);
  const connected = await device.connect({ timeout: 10000 });
  currentDevice = connected;
  await connected.discoverAllServicesAndCharacteristics();
  log('BLE: connected and discovered services');
  return connected;
}

export async function disconnect(): Promise<void> {
  if (notifySubscription) {
    try { notifySubscription(); } catch {}
    notifySubscription = null;
  }
  if (currentDevice) {
    try { await currentDevice.cancelConnection(); } catch {}
    currentDevice = null;
  }
}

export async function writeCommand(text: string): Promise<void> {
  if (!currentDevice) throw new Error('No hay dispositivo conectado');
  const payload = b64encode(text);
  await currentDevice.writeCharacteristicWithoutResponseForService(
    SERVICE_UUID,
    CHAR_COMMAND_UUID,
    payload
  );
}

export async function subscribeNotifications(cb: NotifyCallback): Promise<void> {
  if (!currentDevice) throw new Error('No hay dispositivo conectado');
  if (notifySubscription) {
    try { notifySubscription(); } catch {}
    notifySubscription = null;
  }
  
  log('BLE: starting notification monitor');
  // Apply monitor directly - no need to read first for NOTIFY characteristics
  const monitorSub = currentDevice.monitorCharacteristicForService(
    SERVICE_UUID,
    CHAR_NOTIFY_UUID,
    (error, characteristic: Characteristic | null) => {
      if (error) {
        log('BLE notify error', error.message);
        return;
      }
      // Log raw value (base64) to help debugging
      const raw = characteristic?.value ?? null;
      log('BLE notify raw base64:', String(raw));
      const value = raw ? b64decode(raw) : '';
      log('BLE notify decoded JSON:', value);
      log('BLE notify length:', value.length, 'bytes');
      cb(value);
    }
  );
  notifySubscription = () => monitorSub.remove();
  log('BLE: notification monitor started');
}

/**
 * Connect + subscribe helper.
 * Scans, connects and subscribes to notifications with the provided callback.
 * Returns the connected Device.
 */
export async function connectAndSubscribe(cb: NotifyCallback): Promise<Device> {
  // Connect (scanAndConnect ensures Linux/Android permissions are checked)
  const device = await scanAndConnect();
  // subscribe to notifications (will set notifySubscription)
  await subscribeNotifications(cb);
  return device;
}

/**
 * Connect, subscribe and send START command after subscription.
 * Useful for clients that want to ensure they receive notifications immediately.
 */
export async function connectSubscribeAndStart(cb: NotifyCallback): Promise<Device> {
  const device = await connectAndSubscribe(cb);
  // small delay to ensure subscription propagated to peripheral
  await new Promise((r) => setTimeout(r, 120));
  await writeCommand('START');
  return device;
}

export function getCurrentDevice(): Device | null {
  return currentDevice;
}

