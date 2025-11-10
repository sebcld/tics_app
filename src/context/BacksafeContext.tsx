import { BacksafeCommands, parseNotifyPayload } from '@/src/services/backsafeProtocol';
import { disconnect, scanAndConnect, subscribeNotifications, writeCommand } from '@/src/services/ble';
import { log } from '@/src/utils/logger';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Device } from 'react-native-ble-plx';

type PostureStatus = 'unknown' | 'ok' | 'alert';

type Ctx = {
  connecting: boolean;
  connected: boolean;
  device?: Device | null;
  statusText: string;
  posture: PostureStatus;
  angle?: number;
  alertActive: boolean;
  connect: () => Promise<void>;
  calibrate: () => Promise<void>;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const BacksafeContext = createContext<Ctx | null>(null);

export function BacksafeProvider({ children }: { children: React.ReactNode }) {
  const [connecting, setConnecting] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [statusText, setStatusText] = useState('Desconectado');
  const [posture, setPosture] = useState<PostureStatus>('unknown');
  const [angle, setAngle] = useState<number | undefined>(undefined);
  const [alertActive, setAlertActive] = useState(false);

  async function doConnect() {
    setConnecting(true);
    setStatusText('Buscando Backsafe por BLE...');
    try {
      const d = await scanAndConnect();
      setDevice(d);
      setStatusText(`Conectado a ${d.name || d.localName || d.id}`);
      await subscribeNotifications((text) => {
        const evt = parseNotifyPayload(text);
        if (!evt) return;
        if (typeof evt.angle === 'number') setAngle(evt.angle);
        if (typeof evt.alert === 'boolean') setAlertActive(evt.alert);
        if (evt.status) setPosture(evt.status);
      });
    } catch (e: any) {
      log('BLE connect error', e?.message || String(e));
      setStatusText('Error de conexión BLE');
    } finally {
      setConnecting(false);
    }
  }

  async function doCalibrate() {
    await writeCommand(`${BacksafeCommands.CALIBRATE}\n`);
    setStatusText('Calibración enviada');
  }

  async function doStart() {
    await writeCommand(`${BacksafeCommands.START}\n`);
    setStatusText('Monitoreo iniciado');
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
