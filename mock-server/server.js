const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');

const PORT = process.env.MOCK_PORT || 4000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false // Deshabilitar compresión para mejor compatibilidad
});

// Serve static control page
app.use(express.static(path.join(__dirname, 'public')));

// Función para obtener la IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar direcciones internas (no IPv4) y no locales
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
let clientCount = 0;

wss.on('connection', (ws, req) => {
  clientCount++;
  const clientIP = req.socket.remoteAddress || 'unknown';
  console.log(`[mock-server] Client #${clientCount} connected from ${clientIP}`);
  console.log(`[mock-server] Total clients: ${wss.clients.size}`);

  // Enviar mensaje de bienvenida al cliente
  ws.send(JSON.stringify({ 
    type: 'connection', 
    message: 'Connected to Backsafe Mock Server',
    clientId: clientCount 
  }));

  ws.on('message', (msg) => {
    const messageStr = msg.toString();
    console.log(`[mock-server] Received from client #${clientCount}:`, messageStr.substring(0, 100));
    
    // Broadcast to all clients (including RN app)
    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      }
    });
    
    if (sentCount > 0) {
      console.log(`[mock-server] Broadcasted to ${sentCount} client(s)`);
    }
  });

  ws.on('error', (error) => {
    console.error(`[mock-server] Client #${clientCount} error:`, error.message);
  });

  ws.on('close', () => {
    clientCount--;
    console.log(`[mock-server] Client disconnected. Remaining clients: ${wss.clients.size}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('[mock-server] Backsafe Mock Server');
  console.log('========================================');
  console.log(`Web UI: http://localhost:${PORT}`);
  console.log(`Web UI (network): http://${localIP}:${PORT}`);
  console.log(`WebSocket (local): ws://localhost:${PORT}`);
  console.log(`WebSocket (Android): ws://${localIP}:${PORT}`);
  console.log('========================================\n');
  console.log('Para conectar desde Android:');
  console.log(`1. Asegúrate de que tu dispositivo Android esté en la misma red WiFi`);
  console.log(`2. Usa esta URL en la app: ws://${localIP}:${PORT}`);
  console.log(`3. O configura EXPO_PUBLIC_MOCK_WS_URL=ws://${localIP}:${PORT}\n`);
});
