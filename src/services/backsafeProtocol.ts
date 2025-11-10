// UUIDs y comandos del protocolo Backsafe (ajusta según tu firmware)
// Idealmente define estos valores en variables de entorno EXPO_PUBLIC_*

export const SERVICE_UUID =
  process.env.EXPO_PUBLIC_BACKSAFE_SERVICE_UUID?.toLowerCase() ||
  '0000fff0-0000-1000-8000-00805f9b34fb';

// Característica para enviar comandos al ESP32
export const CHAR_COMMAND_UUID =
  process.env.EXPO_PUBLIC_BACKSAFE_CHAR_COMMAND_UUID?.toLowerCase() ||
  '0000fff1-0000-1000-8000-00805f9b34fb';

// Característica que notifica estados (postura, alertas)
export const CHAR_NOTIFY_UUID =
  process.env.EXPO_PUBLIC_BACKSAFE_CHAR_NOTIFY_UUID?.toLowerCase() ||
  '0000fff2-0000-1000-8000-00805f9b34fb';

export const DEVICE_NAME_PREFIX =
  process.env.EXPO_PUBLIC_BACKSAFE_NAME_PREFIX || 'Backsafe';

// Comandos simples basados en texto. Ajusta a tu firmware si usas binario o JSON.
export const BacksafeCommands = {
  CALIBRATE: 'CALIBRATE',
  START: 'START',
  STOP: 'STOP',
} as const;

export type BacksafeEvent = {
  angle?: number;
  alert?: boolean;
  status?: 'ok' | 'alert' | 'unknown';
};

// Intenta parsear un payload recibido por notificación como JSON
export function parseNotifyPayload(text: string): BacksafeEvent | null {
  try {
    const obj = JSON.parse(text);
    return {
      angle: typeof obj.angle === 'number' ? obj.angle : undefined,
      alert: typeof obj.alert === 'boolean' ? obj.alert : undefined,
      status:
        obj.status === 'ok' || obj.status === 'alert' ? obj.status : 'unknown',
    };
  } catch {
    // Como fallback, interpreta cadenas simples: 'ALERT' o 'OK'
    if (text.trim().toUpperCase().includes('ALERT')) return { alert: true, status: 'alert' };
    if (text.trim().toUpperCase().includes('OK')) return { alert: false, status: 'ok' };
    return null;
  }
}
