import { BacksafeCommands, parseNotifyPayload } from '@/src/services/backsafeProtocol';
import { connectAndSubscribe, disconnect, writeCommand } from '@/src/services/bluetoothClassic';
import { log } from '@/src/utils/logger';
import React, { createContext, useContext, useMemo, useState } from 'react';

type PostureStatus = 'unknown' | 'ok' | 'alert';

type Ctx = {
  connecting: boolean;
  connected: boolean;
  device?: any | null;
  statusText: string;
  posture: PostureStatus;
  angle?: number;
  alertActive: boolean;
  connect: () => Promise<void>;
  calibrate: () => Promise<void>;
  calibratePosture: () => Promise<void>;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const BacksafeContext = createContext<Ctx | null>(null);

export function BacksafeProvider({ children }: { children: React.ReactNode }) {
  const [connecting, setConnecting] = useState(false);
  const [device, setDevice] = useState<any | null>(null);
  const [statusText, setStatusText] = useState('Desconectado');
  const [posture, setPosture] = useState<PostureStatus>('unknown');
  const [angle, setAngle] = useState<number | undefined>(undefined);
  const [alertActive, setAlertActive] = useState(false);

  async function doConnect() {
    setConnecting(true);
    setStatusText('Buscando Backsafe por Bluetooth Classic...');
    try {
      const d = await connectAndSubscribe((text) => {
        log('Notify callback received:', text);
        const evt = parseNotifyPayload(text);
        if (!evt) {
          log('Parse failed for:', text);
          return;
        }
        log('Parsed event:', JSON.stringify(evt));
        if (typeof evt.angle === 'number') {
          log('Setting angle:', evt.angle);
          setAngle(evt.angle);
        }
        if (typeof evt.alert === 'boolean') {
          log('Setting alert:', evt.alert);
          setAlertActive(evt.alert);
        }
        if (evt.status) {
          log('Setting posture:', evt.status);
          setPosture(evt.status);
        }
      });
      setDevice(d);
      setStatusText(`Conectado a ${d.name || d.id}`);
      log('Connection complete, subscription active');
    } catch (e: any) {
      log('Bluetooth Classic connect error', e?.message || String(e));
      setStatusText('Error de conexión Bluetooth');
    } finally {
      setConnecting(false);
    }
  }

  async function doCalibrate() {
    try {
      log('Sending CALIBRATE command');
      await writeCommand('CALIBRATE\n');
      setStatusText('Calibración de baseline enviada');
      log('CALIBRATE command sent');
    } catch (e: any) {
      log('Error sending CALIBRATE:', e?.message || String(e));
      setStatusText('Error en calibración');
    }
  }

  async function doCalibratePosture() {
    try {
      log('Sending CALIBRATE_POSTURE command');
      await writeCommand('CALIBRATE_POSTURE\n');
      setStatusText('Calibración de postura enviada - siéntate correctamente');
      log('CALIBRATE_POSTURE command sent');
    } catch (e: any) {
      log('Error sending CALIBRATE_POSTURE:', e?.message || String(e));
      setStatusText('Error en calibración de postura');
    }
  }

  async function doStart() {
    try {
      log('Sending START command');
      await writeCommand(`${BacksafeCommands.START}\n`);
      setStatusText('Monitoreo iniciado');
      log('START command sent');
    } catch (e: any) {
      log('Error sending START:', e?.message || String(e));
      setStatusText('Error al iniciar monitoreo');
    }
  }

  async function doStop() {
    await writeCommand(`${BacksafeCommands.STOP}\n`);
    setStatusText('Monitoreo detenido');
  }

  async function doDisconnect() {
    await disconnect();
    setDevice(null);
    setStatusText('Desconectado');
    setPosture('unknown');
    setAngle(undefined);
    setAlertActive(false);
  }

  const value = useMemo<Ctx>(() => ({
    connecting,
    connected: !!device,
    device,
    statusText,
    posture,
    angle,
    alertActive,
    connect: doConnect,
    calibrate: doCalibrate,
    calibratePosture: doCalibratePosture,
    startMonitoring: doStart,
    stopMonitoring: doStop,
    disconnect: doDisconnect,
  }), [connecting, device, statusText, posture, angle, alertActive]);

  return (
    <BacksafeContext.Provider value={value}>{children}</BacksafeContext.Provider>
  );
}

export function useBacksafe() {
  const ctx = useContext(BacksafeContext);
  if (!ctx) throw new Error('useBacksafe debe usarse dentro de BacksafeProvider');
  return ctx;
}
