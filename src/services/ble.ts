import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { encode as b64encode, decode as b64decode } from 'base-64';
import { log } from '@/src/utils/logger';
import {
  SERVICE_UUID,
  CHAR_COMMAND_UUID,
  CHAR_NOTIFY_UUID,
  DEVICE_NAME_PREFIX,
} from '@/src/services/backsafeProtocol';

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

async function scanFirstMatching(onFound?: (device: Device) => void): Promise<Device> {
  return new Promise((resolve, reject) => {
    log('BLE: scanning for devices...');
    const subscription = manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
      if (error) {
        subscription.remove();
        return reject(error);
      }
      if (!device) return;
      if (
        (device.name && device.name.startsWith(DEVICE_NAME_PREFIX)) ||
        (device.localName && device.localName.startsWith(DEVICE_NAME_PREFIX))
      ) {
        log('BLE: found', device.name || device.localName, device.id);
        onFound?.(device);
        subscription.remove();
        resolve(device);
      }
    });
    // Fallback timeout
    setTimeout(() => {
      subscription.remove();
      reject(new Error('No se encontró un dispositivo Backsafe por BLE'));
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
  const char = await currentDevice.readCharacteristicForService(
    SERVICE_UUID,
    CHAR_NOTIFY_UUID
  );
  // Apply monitor
  const monitorSub = currentDevice.monitorCharacteristicForService(
    SERVICE_UUID,
    CHAR_NOTIFY_UUID,
    (error, characteristic: Characteristic | null) => {
      if (error) {
        log('BLE notify error', error.message);
        return;
      }
      const value = characteristic?.value ? b64decode(characteristic.value) : '';
      cb(value);
    }
  );
  notifySubscription = () => monitorSub.remove();
}

export function getCurrentDevice(): Device | null {
  return currentDevice;
}

