import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WSMessage } from '@finance-automation/shared';

let wss: WebSocketServer;

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('close', () => console.log('WebSocket client disconnected'));
    ws.on('error', (err) => console.error('WebSocket error:', err));
  });
}

export function broadcast(message: WSMessage): void {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
