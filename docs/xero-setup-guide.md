# Xero Integration Setup Guide

## Prerequisites

- A Xero account (free trial works)
- A Xero Developer account at https://developer.xero.com

---

## Step 1: Create a Xero App

1. Go to https://developer.xero.com/myapps
2. Click **New app**
3. Fill in the details:
   - **App name**: Finance Automation (or any name)
   - **Integration type**: Web app
   - **Company or application URL**: `http://localhost:3001` (for development)
   - **Redirect URI**: `http://localhost:3001/api/xero/callback`
4. Click **Create app**
5. Copy the **Client ID** from the app dashboard
6. Click **Generate a secret** and copy the **Client Secret** (you won't see it again)

## Step 2: Redirect URI

### Can I use localhost?

**Yes.** Xero allows `http://localhost` redirect URIs for development. No HTTPS required for localhost.

Valid examples:
- `http://localhost:3001/api/xero/callback`
- `http://localhost:5000/callback`

### Production

For production, you **must** use HTTPS:
- `https://yourdomain.com/api/xero/callback`

### Rules

- Must be an absolute URI (no wildcards like `https://*.example.com`)
- Must exactly match what's registered in the Xero app settings
- You can register up to 50 redirect URIs per app

## Step 3: Configure Environment Variables

Add the following to `packages/backend/.env`:

```env
# Xero OAuth2
XERO_CLIENT_ID=your_client_id_here
XERO_CLIENT_SECRET=your_client_secret_here
XERO_REDIRECT_URI=http://localhost:3001/api/xero/callback
```

## Step 4: Install the SDK

From the project root:

```bash
npm install xero-node -w packages/backend
```

## Step 5: Required OAuth2 Scopes

The app requests these scopes during authorization:

| Scope | Purpose |
|---|---|
| `openid` | Required for OpenID Connect |
| `profile` | User profile info |
| `email` | User email |
| `accounting.transactions` | Create/read/update invoices, bills, credit notes |
| `accounting.contacts` | Read/manage contacts (vendors) |
| `accounting.settings` | Read chart of accounts, tax rates |
| `offline_access` | Get a refresh token for long-lived access |

## Step 6: OAuth2 Flow Overview

```
Browser                     Backend                        Xero
  |                           |                              |
  |-- GET /api/xero/connect ->|                              |
  |                           |-- redirect to Xero login --->|
  |                           |                              |
  |                           |<-- callback with auth code --|
  |                           |                              |
  |                           |-- exchange code for tokens ->|
  |                           |<-- access + refresh tokens --|
  |                           |                              |
  |<-- redirect to app -------|                              |
  |                           |                              |
  |-- API calls ------------->|-- use access_token --------->|
```

1. User clicks "Connect to Xero" in the frontend
2. Backend redirects to Xero's authorization URL
3. User logs in and grants permissions on Xero's site
4. Xero redirects back to `XERO_REDIRECT_URI` with an authorization code
5. Backend exchanges the code for an access token + refresh token
6. Tokens are stored for future API calls

## Step 7: Token Lifecycle

| Token | Expiry | Action |
|---|---|---|
| Access token | **30 minutes** | Refresh before each API call |
| Refresh token | **60 days** | User must re-authorize after expiry |

The backend should refresh the access token automatically before making API calls:

```typescript
import { XeroClient } from 'xero-node';

const xero = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUris: [process.env.XERO_REDIRECT_URI],
  scopes: [
    'openid',
    'profile',
    'email',
    'accounting.transactions',
    'accounting.contacts',
    'accounting.settings',
    'offline_access',
  ],
});

// After initial auth, before each API call:
const tokenSet = await xero.readTokenSet();
if (tokenSet.expired()) {
  await xero.refreshToken();
}
```

## Step 8: Key API Endpoints for Invoice Sync

Once connected, the app will use these Xero API methods:

```typescript
// Create an invoice in Xero
await xero.accountingApi.createInvoices(tenantId, {
  invoices: [{
    type: Invoice.TypeEnum.ACCPAY,     // bill/payable
    contact: { name: 'Vendor Name' },
    lineItems: [{
      description: 'Service',
      quantity: 1,
      unitAmount: 100.00,
      accountCode: '200',
    }],
    date: '2023-10-02',
    dueDate: '2023-10-16',
    invoiceNumber: 'INV-0001',
    currencyCode: CurrencyCode.USD,
    status: Invoice.StatusEnum.DRAFT,
  }],
});

// List invoices
const invoices = await xero.accountingApi.getInvoices(tenantId);

// Get contacts (vendors)
const contacts = await xero.accountingApi.getContacts(tenantId);
```

## Troubleshooting

| Issue | Fix |
|---|---|
| "Invalid redirect URI" | Ensure `XERO_REDIRECT_URI` exactly matches what's in Xero app settings |
| "Token expired" | Refresh token may have expired (60 days) — user needs to re-authorize |
| "Forbidden" | Check that the correct scopes are requested |
| "Invalid client" | Double-check `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` |

## References

- Xero OAuth2 Overview: https://developer.xero.com/documentation/guides/oauth2/overview/
- Xero Auth Flow: https://developer.xero.com/documentation/guides/oauth2/auth-flow/
- xero-node SDK: https://github.com/XeroAPI/xero-node
- Xero Node OAuth2 Example: https://github.com/XeroAPI/xero-node-oauth2-app
