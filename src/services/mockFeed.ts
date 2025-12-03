import { log } from '@/src/utils/logger';

export type MockNotifyCallback = (text: string) => void;

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

export function connectMockAndSubscribe(cb: MockNotifyCallback, url: string): Promise<{ id: string; name: string }> {
  return new Promise((resolve, reject) => {
    // Limpiar conexión anterior si existe
    if (socket) {
      try {
        socket.close();
      } catch (e) {
        // Ignorar errores al cerrar
      }
      socket = null;
    }

    // Limpiar timeout de reconexión si existe
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    reconnectAttempts = 0;

    try {
      log('Mock WS: attempting to connect to', url);
      
      // En React Native, WebSocket está disponible globalmente
      socket = new WebSocket(url);
      
      socket.onopen = () => {
        log('Mock WS: connected successfully to', url);
        reconnectAttempts = 0; // Reset contador de reconexión
        resolve({ id: 'mock-ws', name: 'Mock WS' });
      };
      
      socket.onerror = (e: any) => {
        const errorMsg = e?.message || String(e) || 'Unknown WebSocket error';
        log('Mock WS: connection error', errorMsg);
        
        // Si aún no se ha conectado, rechazar la promesa
        if (socket?.readyState !== WebSocket.OPEN) {
          reject(new Error(`Mock WS connection error: ${errorMsg}. Asegúrate de usar la IP de tu máquina en lugar de localhost (ej: ws://192.168.1.100:4000)`));
        }
      };
      
      socket.onmessage = (evt) => {
        try {
          const data = typeof evt.data === 'string' ? evt.data : String(evt.data);
          log('Mock WS: received message', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
          cb(data);
        } catch (e: any) {
          log('Mock WS: error processing message', e?.message || String(e));
        }
      };
      
      socket.onclose = (event) => {
        log('Mock WS: connection closed', {
          code: event.code,
          reason: event.reason || 'No reason provided',
          wasClean: event.wasClean
        });
        
        socket = null;
        
        // Intentar reconectar si no fue un cierre limpio y no excedemos los intentos
        if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          log(`Mock WS: attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY}ms`);
          
          reconnectTimeout = setTimeout(() => {
            connectMockAndSubscribe(cb, url).catch((err) => {
              log('Mock WS: reconnect failed', err.message);
            });
          }, RECONNECT_DELAY);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          log('Mock WS: max reconnect attempts reached');
        }
      };
      
      // Timeout de conexión (10 segundos)
      setTimeout(() => {
        if (socket && socket.readyState !== WebSocket.OPEN) {
          log('Mock WS: connection timeout');
          socket.close();
          reject(new Error(`Connection timeout. Verifica que el servidor esté corriendo en ${url} y que uses la IP correcta de tu máquina (no localhost)`));
        }
      }, 10000);
      
    } catch (e: any) {
      log('Mock WS: exception during connection', e?.message || String(e));
      reject(new Error(`Failed to create WebSocket connection: ${e?.message || String(e)}`));
    }
  });
}

export async function disconnectMock(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      log('Mock WS: error closing socket', String(e));
    }
    socket = null;
  }
  
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevenir reconexión automática
  log('Mock WS: disconnected');
}

/**
 * Envía un comando al servidor mock (opcional, para logging)
 */
export async function writeCommand(text: string): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log('Mock WS: cannot send command, not connected');
    return;
  }
  
  // En modo mock, los comandos se pueden enviar al servidor para logging
  // pero no tienen efecto real
  const command = text.trim();
  log('Mock WS: sending command:', command);
  
  try {
    socket.send(JSON.stringify({ 
      type: 'command', 
      command: command,
      ts: Date.now()
    }));
  } catch (e: any) {
    log('Mock WS: error sending command', e?.message || String(e));
    throw new Error(`Error enviando comando: ${e?.message || String(e)}`);
  }
}
