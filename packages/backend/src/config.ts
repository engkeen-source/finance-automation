import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(env('PORT', '3001'), 10),
  host: env('HOST', 'localhost'),
  databaseUrl: env('DATABASE_URL', 'postgresql://localhost:5432/finance_automation'),
  inboxPath: path.resolve(rootDir, env('INBOX_PATH', './inbox')),
  storagePath: path.resolve(rootDir, env('STORAGE_PATH', './storage')),
  quickbooks: {
    clientId: env('QB_CLIENT_ID'),
    clientSecret: env('QB_CLIENT_SECRET'),
    redirectUri: env('QB_REDIRECT_URI', 'http://localhost:3001/api/quickbooks/callback'),
    environment: env('QB_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production',
    realmId: env('QB_REALM_ID'),
  },
  xero: {
    clientId: env('XERO_CLIENT_ID'),
    clientSecret: env('XERO_CLIENT_SECRET'),
    redirectUri: env('XERO_REDIRECT_URI', 'http://localhost:3001/api/xero/callback'),
    scopes: [
      'openid',
      'profile',
      'email',
      'accounting.invoices',
      'accounting.payments',
      'accounting.contacts',
      'accounting.settings',
      'accounting.attachments',
      'offline_access',
    ],
  },
};
