import { BacksafeCommands, parseNotifyPayload } from '@/src/services/backsafeProtocol';
import { connectAndSubscribe, disconnect as disconnectBt, writeCommand as writeBluetoothCommand } from '@/src/services/bluetoothClassic';
import { connectMockAndSubscribe, disconnectMock, writeCommand as writeMockCommand } from '@/src/services/mockFeed';
import { log } from '@/src/utils/logger';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';

type PostureStatus = 'unknown' | 'ok' | 'alert';
type ConnectionMode = 'bluetooth' | 'mock';

type Ctx = {
  connecting: boolean;
  connected: boolean;
  device?: any | null; // preferimos mostrar el dispositivo BT
  statusText: string;
  posture: PostureStatus;
  angle?: number;
  alertActive: boolean;
  zoneStatus?: string;
  sensorValues: number[];
  seatSum?: number;
  backSum?: number;
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
  const [device, setDevice] = useState<any | null>(null); // BT device
  const [statusText, setStatusText] = useState('Desconectado');
  const [posture, setPosture] = useState<PostureStatus>('unknown');
  const [angle, setAngle] = useState<number | undefined>(undefined);
  const [alertActive, setAlertActive] = useState(false);
  const [zoneStatus, setZoneStatus] = useState<string | undefined>(undefined);
  const [sensorValues, setSensorValues] = useState<number[]>([]);
  const [seatSum, setSeatSum] = useState<number | undefined>(undefined);
  const [backSum, setBackSum] = useState<number | undefined>(undefined);

  const [primaryMode, setPrimaryMode] = useState<ConnectionMode | null>(null); // para comandos
  const [btConnected, setBtConnected] = useState(false);
  const [mockConnected, setMockConnected] = useState(false); // canal web para alertas

  const mockEnabled =
    process.env.EXPO_PUBLIC_USE_MOCK_WS === 'true' ||
    (!!process.env.EXPO_PUBLIC_MOCK_WS_URL && process.env.EXPO_PUBLIC_MOCK_WS_URL.startsWith('ws://'));
  const mockUrl = process.env.EXPO_PUBLIC_MOCK_WS_URL || 'ws://localhost:4000';
  const forceMock =
    Platform.OS === 'web' ||
    process.env.EXPO_PUBLIC_FORCE_MOCK_WS === 'true';
  const preferMockFirst =
    forceMock ||
    (mockEnabled && process.env.EXPO_PUBLIC_PREFER_MOCK_FIRST === 'true');

  async function doConnect() {
    setConnecting(true);
    setStatusText('Conectando a ESP32 y 🐍...');
    log('Backsafe connect: forceMock=', forceMock, 'preferMockFirst=', preferMockFirst, 'mockEnabled=', mockEnabled, 'url=', mockUrl);

    let lastError: any = null;
    let bt: any = null;
    let mock: any = null;

    try {
      const connectMock = async () => {
        const d = await connectMockAndSubscribe(onNotifyFromMock, mockUrl);
        setMockConnected(true);
        setPrimaryMode((prev) => prev ?? 'mock');
        setDevice((prev) => prev ?? d);
        log('Connection complete via mock WebSocket');
        return d;
      };

      const connectBt = async () => {
        const d = await connectAndSubscribe(onNotifyFromBt);
        setDevice(d);
        setPrimaryMode('bluetooth');
        setBtConnected(true);
        log('Connection complete via Bluetooth Classic, subscription active');
        return d;
      };

      // Conectar en el orden deseado (mock primero si se pide)
      if (preferMockFirst && (mockEnabled || forceMock)) {
        try {
          mock = await connectMock();
        } catch (mockErr: any) {
          lastError = mockErr;
          log('Mock WebSocket connect error', mockErr?.message || String(mockErr));
        }
      }

      if (!forceMock) {
        try {
          bt = await connectBt();
        } catch (btErr: any) {
          lastError = btErr;
          log('Bluetooth Classic connect error', btErr?.message || String(btErr));
        }
      }

      // Si no intentamos mock primero, probar ahora
      if (!mock && !preferMockFirst && (mockEnabled || forceMock)) {
        try {
          mock = await connectMock();
        } catch (mockErr: any) {
          lastError = mockErr;
          log('Mock WebSocket connect error', mockErr?.message || String(mockErr));
        }
      }

      if (!bt && !mock) {
        throw lastError || new Error('No hay modo de conexion disponible');
      }

      if (bt && mock) {
        setStatusText(`Conectado: ESP32 (${bt.name || bt.id}) + 🐍`);
      } else if (bt) {
        setStatusText(`Conectado a ESP32 ${bt.name || bt.id}`);
      } else if (mock) {
        setStatusText(`Conectado solo a mock (${mockUrl})`);
      }
    } catch (e: any) {
      log('Backsafe connect failed', e?.message || String(e));
      setDevice(null);
      setPrimaryMode(null);
      setBtConnected(false);
      setMockConnected(false);
      setStatusText(forceMock ? 'Error de conexion mock' : 'Error de conexion Bluetooth');
    } finally {
      setConnecting(false);
    }
  }

  function onNotifyFromBt(text: string) {
    log('Notify (BT) received:', text);
    const evt = parseNotifyPayload(text);
    if (evt) {
      if (typeof evt.angle === 'number') setAngle(evt.angle);
      if (typeof evt.alert === 'boolean') setAlertActive(evt.alert);
      if (evt.status) setPosture(evt.status);
    }

    // Datos de sensores
    try {
      const raw = JSON.parse(text);
      if (Array.isArray(raw?.values)) {
        const parsed = raw.values.map((v: any) => Number(v) || 0);
        setSensorValues(parsed);
      }
      if (typeof raw?.seatSum === 'number') setSeatSum(raw.seatSum);
      if (typeof raw?.backSum === 'number') setBackSum(raw.backSum);
      if (typeof raw?.zoneStatus === 'string' && raw.zoneStatus.trim().length > 0) {
        setZoneStatus(raw.zoneStatus.trim());
      }
    } catch {
      // ignore parse errors for sensor details
    }

    // Fallback: formato simple con arreglo de sensores tipo "{DATA,{...}}"
    const sensorMatch = text.match(/{([^{}]+)}/g);
    if (sensorMatch && sensorMatch.length > 0) {
      const lastBlock = sensorMatch[sensorMatch.length - 1];
      const nums = lastBlock
        .replace(/[{}]/g, '')
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v));
      if (nums.length > 0) {
        setSensorValues(nums);
        setSeatSum(nums.reduce((a, b) => a + b, 0));
        setBackSum(undefined);
      }
    }
  }

  function onNotifyFromMock(text: string) {
    log('Notify (mock) received:', text);
    const evt = parseNotifyPayload(text);
    if (evt) {
      if (typeof evt.angle === 'number') setAngle(evt.angle);
      if (typeof evt.alert === 'boolean') setAlertActive(evt.alert);
      if (evt.status) setPosture(evt.status);
    }
    try {
      const raw = JSON.parse(text);
      if (typeof raw?.zoneStatus === 'string' && raw.zoneStatus.trim().length > 0) {
        setZoneStatus(raw.zoneStatus.trim());
      }
    } catch {
      // ignore parse errors
    }
  }

  function pickWriteFn() {
    const preferMock = primaryMode === 'mock' && !btConnected;
    if (!preferMock && btConnected) return writeBluetoothCommand;
    if (mockConnected) return writeMockCommand;
    return writeBluetoothCommand;
  }

  async function doCalibrate() {
    try {
      log('Sending CALIBRATE command');
      const writeFn = pickWriteFn();
      await writeFn('CALIBRATE\n');
      setStatusText('Calibracion de baseline enviada');
      log('CALIBRATE command sent');
    } catch (e: any) {
      log('Error sending CALIBRATE:', e?.message || String(e));
      setStatusText('Error en calibracion');
    }
  }

  async function doCalibratePosture() {
    try {
      log('Sending CALIBRATE_POSTURE command');
      const writeFn = pickWriteFn();
      await writeFn('CALIBRATE_POSTURE\n');
      setStatusText('Calibracion de postura enviada - sientate correctamente');
      log('CALIBRATE_POSTURE command sent');
    } catch (e: any) {
      log('Error sending CALIBRATE_POSTURE:', e?.message || String(e));
      setStatusText('Error en calibracion de postura');
    }
  }

  async function doStart() {
    try {
      log('Sending START command');
      const writeFn = pickWriteFn();
      await writeFn(`${BacksafeCommands.START}\n`);
      setStatusText('Monitoreo iniciado');
      log('START command sent');
    } catch (e: any) {
      log('Error sending START:', e?.message || String(e));
      setStatusText('Error al iniciar monitoreo');
    }
  }

  async function doStop() {
    try {
      const writeFn = pickWriteFn();
      await writeFn(`${BacksafeCommands.STOP}\n`);
      setStatusText('Monitoreo detenido');
    } catch (e: any) {
      log('Error sending STOP:', e?.message || String(e));
      setStatusText('Error al detener monitoreo');
    }
  }

  async function doDisconnect() {
    try {
      await disconnectMock();
    } catch {}
    try {
      await disconnectBt();
    } catch {}
    setPrimaryMode(null);
    setMockConnected(false);
    setBtConnected(false);
    setDevice(null);
    setStatusText('Desconectado');
    setPosture('unknown');
    setAngle(undefined);
    setAlertActive(false);
    setZoneStatus(undefined);
    setSensorValues([]);
    setSeatSum(undefined);
    setBackSum(undefined);
  }

  const value = useMemo<Ctx>(() => ({
    connecting,
    connected: btConnected || mockConnected,
    device,
    statusText,
    posture,
    angle,
    alertActive,
    zoneStatus,
    sensorValues,
    seatSum,
    backSum,
    connect: doConnect,
    calibrate: doCalibrate,
    calibratePosture: doCalibratePosture,
    startMonitoring: doStart,
    stopMonitoring: doStop,
    disconnect: doDisconnect,
  }), [connecting, btConnected, mockConnected, device, statusText, posture, angle, alertActive, zoneStatus, sensorValues, seatSum, backSum]);

  return (
    <BacksafeContext.Provider value={value}>{children}</BacksafeContext.Provider>
  );
}

export function useBacksafe() {
  const ctx = useContext(BacksafeContext);
  if (!ctx) throw new Error('useBacksafe debe usarse dentro de BacksafeProvider');
  return ctx;
}
