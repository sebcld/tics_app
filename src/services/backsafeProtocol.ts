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
    const obj: any = JSON.parse(text);

    // Determine alert flag: explicit alert or zoneAlert
    let alertFlag: boolean | undefined = undefined;
    if (typeof obj.alert === 'boolean') alertFlag = obj.alert;
    else if (typeof obj.zoneAlert === 'boolean') alertFlag = obj.zoneAlert;

    // Determine approximate angle: prefer explicit, else derive from values array
    let angleVal: number | undefined = undefined;
    if (typeof obj.angle === 'number') {
      angleVal = obj.angle;
    } else if (Array.isArray(obj.values) && obj.values.length > 0) {
      // assume first up-to-10 values are seat sensors; split left/right
      const seatCount = Math.min(10, obj.values.length);
      const leftCount = Math.floor(seatCount / 2);
      let leftSum = 0;
      let rightSum = 0;
      for (let i = 0; i < seatCount; ++i) {
        const v = Number(obj.values[i]) || 0;
        if (i < leftCount) leftSum += v; else rightSum += v;
      }
      const denom = leftSum + rightSum;
      if (denom > 0) {
        angleVal = ((rightSum - leftSum) / denom) * 30.0; // degrees approx
      }
    }

    // Determine status
    let statusVal: 'ok' | 'alert' | 'unknown' = 'unknown';
    if (obj.status === 'ok' || obj.status === 'alert') {
      statusVal = obj.status;
    } else if (alertFlag === true) {
      statusVal = 'alert';
    } else if (typeof obj.occupied === 'boolean') {
      statusVal = obj.occupied ? 'ok' : 'unknown';
    } else if (Array.isArray(obj.values)) {
      // if there is measurable pressure, assume ok
      const sum = obj.values.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
      statusVal = sum > 50 ? 'ok' : 'unknown';
    }

    return {
      angle: angleVal,
      alert: alertFlag,
      status: statusVal,
    };
  } catch {
    // Como fallback, interpreta cadenas simples: 'ALERT' o 'OK'
    if (text.trim().toUpperCase().includes('ALERT')) return { alert: true, status: 'alert' };
    if (text.trim().toUpperCase().includes('OK')) return { alert: false, status: 'ok' };
    return null;
  }
}
