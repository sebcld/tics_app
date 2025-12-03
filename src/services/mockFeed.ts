import { log } from '@/src/utils/logger';

export type MockNotifyCallback = (text: string) => void;

let socket: WebSocket | null = null;

export function connectMockAndSubscribe(cb: MockNotifyCallback, url: string): Promise<{ id: string; name: string }> {
  return new Promise((resolve, reject) => {
    try {
      socket = new WebSocket(url);
      socket.onopen = () => {
        log('Mock WS: connected to', url);
        resolve({ id: 'mock-ws', name: 'Mock WS' });
      };
      socket.onerror = (e: any) => {
        log('Mock WS: error', e?.message || String(e));
        reject(new Error(e?.message || 'Mock WS connection error'));
      };
      socket.onmessage = (evt) => {
        const data = typeof evt.data === 'string' ? evt.data : '';
        cb(data);
      };
    } catch (e) {
      reject(e as any);
    }
  });
}

export async function disconnectMock(): Promise<void> {
  if (socket) {
    socket.close();
    socket = null;
  }
}
