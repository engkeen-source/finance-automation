import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import fs from 'node:fs/promises';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { setupWebSocket } from './services/websocket.js';
import { startInboxWatcher } from './workers/inbox-watcher.js';
import invoiceRoutes from './routes/invoices.js';
import xeroRoutes from './routes/xero.js';

async function main() {
  // Ensure directories exist
  await fs.mkdir(config.inboxPath, { recursive: true });
  await fs.mkdir(config.storagePath, { recursive: true });

  // Run migrations
  await runMigrations();

  const app = express();
  app.use(cors({ origin: 'http://localhost:5176' }));
  app.use(express.json());

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  // Routes
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/xero', xeroRoutes);

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  // Start inbox watcher
  startInboxWatcher();

  server.listen(config.port, config.host, () => {
    console.log(`Backend running at http://${config.host}:${config.port}`);
    console.log(`WebSocket at ws://${config.host}:${config.port}/ws`);
    console.log(`Inbox folder: ${config.inboxPath}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
