import { XeroClient } from 'xero-node';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

let xeroClient: XeroClient | null = null;

export function getXeroClient(): XeroClient {
  if (!xeroClient) {
    xeroClient = new XeroClient({
      clientId: config.xero.clientId,
      clientSecret: config.xero.clientSecret,
      redirectUris: [config.xero.redirectUri],
      scopes: config.xero.scopes,
    });
  }
  return xeroClient;
}

// Store tokens in DB so they survive restarts
export async function saveTokenSet(tokenSet: Record<string, unknown>, tenantId: string): Promise<void> {
  await pool.query(
    `INSERT INTO xero_tokens (id, tenant_id, token_set, updated_at)
     VALUES ('default', $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET tenant_id = $1, token_set = $2, updated_at = NOW()`,
    [tenantId, JSON.stringify(tokenSet)]
  );
}

export async function loadTokenSet(): Promise<{ tenantId: string; tokenSet: Record<string, unknown> } | null> {
  const { rows } = await pool.query('SELECT tenant_id, token_set FROM xero_tokens WHERE id = $1', ['default']);
  if (rows.length === 0) return null;
  return {
    tenantId: rows[0].tenant_id,
    tokenSet: typeof rows[0].token_set === 'string' ? JSON.parse(rows[0].token_set) : rows[0].token_set,
  };
}

export async function deleteTokenSet(): Promise<void> {
  await pool.query('DELETE FROM xero_tokens WHERE id = $1', ['default']);
}

export async function getConnectedClient(): Promise<{ client: XeroClient; tenantId: string } | null> {
  const stored = await loadTokenSet();
  if (!stored) return null;

  const client = getXeroClient();
  client.setTokenSet(stored.tokenSet as never);

  // Refresh if expired
  const tokenSet = client.readTokenSet();
  if (tokenSet.expired()) {
    const newTokenSet = await client.refreshToken();
    await saveTokenSet(newTokenSet as unknown as Record<string, unknown>, stored.tenantId);
  }

  return { client, tenantId: stored.tenantId };
}

export async function isConnected(): Promise<{ connected: boolean; orgName?: string }> {
  try {
    const result = await getConnectedClient();
    if (!result) return { connected: false };

    const { client, tenantId } = result;
    const response = await client.accountingApi.getOrganisations(tenantId);
    const orgName = response.body.organisations?.[0]?.name ?? undefined;
    return { connected: true, orgName };
  } catch {
    return { connected: false };
  }
}
