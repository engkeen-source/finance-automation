import { Router, Request, Response } from 'express';
import { Invoice as XeroInvoice, CurrencyCode, Contact, LineAmountTypes } from 'xero-node';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { getXeroClient, saveTokenSet, deleteTokenSet, getConnectedClient, isConnected } from '../services/xero.js';
import { getInvoiceById, updateInvoice } from '../services/invoice-repository.js';
import { broadcast } from '../services/websocket.js';
import { InvoiceStatus } from '@finance-automation/shared';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
};

async function findInvoiceFile(invoiceId: string): Promise<{ filePath: string; fileName: string } | null> {
  const dirs = [config.storagePath, path.join(config.inboxPath, 'done')];
  for (const dir of dirs) {
    const files = await fs.readdir(dir).catch(() => []);
    const match = files.find((f) => f.startsWith(invoiceId));
    if (match) {
      return { filePath: path.join(dir, match), fileName: match };
    }
  }
  return null;
}

const router = Router();

// Get connection status
router.get('/status', async (_req: Request, res: Response) => {
  const status = await isConnected();
  res.json(status);
});

// Start OAuth flow
router.get('/connect', async (_req: Request, res: Response) => {
  try {
    const client = getXeroClient();
    const consentUrl = await client.buildConsentUrl();
    res.json({ url: consentUrl });
  } catch (err) {
    console.error('Xero connect error:', err);
    res.status(500).json({ error: 'Failed to build Xero consent URL' });
  }
});

// OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const client = getXeroClient();
    const tokenSet = await client.apiCallback(req.url as string);
    await client.updateTenants();

    const tenants = client.tenants;
    if (tenants.length === 0) {
      res.status(400).send('No Xero organisations found. Please grant access to at least one organisation.');
      return;
    }

    const tenantId = tenants[0].tenantId;
    await saveTokenSet(tokenSet as unknown as Record<string, unknown>, tenantId);

    // Redirect back to frontend
    res.redirect('http://localhost:5176?xero=connected');
  } catch (err) {
    console.error('Xero callback error:', err);
    res.redirect('http://localhost:5176?xero=error');
  }
});

// Disconnect
router.post('/disconnect', async (_req: Request, res: Response) => {
  await deleteTokenSet();
  res.json({ message: 'Disconnected from Xero' });
});

// Sync a single approved invoice to Xero
router.post('/sync/:invoiceId', async (req: Request, res: Response) => {
  const invoiceId = req.params.invoiceId as string;

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (invoice.status !== InvoiceStatus.APPROVED) {
    res.status(400).json({ error: 'Invoice must be approved before syncing' });
    return;
  }

  const connection = await getConnectedClient();
  if (!connection) {
    res.status(400).json({ error: 'Not connected to Xero' });
    return;
  }

  const { client, tenantId } = connection;

  try {
    // Build Xero invoice line items with proportional tax distribution
    const invoiceSubtotal = invoice.subtotal ?? invoice.lineItems.reduce((s, i) => s + i.amount, 0);
    const invoiceTax = invoice.taxAmount ?? 0;

    const lineItems = invoice.lineItems.map((item) => {
      // Distribute tax proportionally across line items
      const proportion = invoiceSubtotal > 0 ? item.amount / invoiceSubtotal : 0;
      const itemTax = Math.round(invoiceTax * proportion * 100) / 100;
      return {
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitPrice,
        taxType: 'NONE' as const,
        taxAmount: itemTax,
        accountCode: '200', // default expense account
      };
    });

    // If no line items, create a single line from total
    if (lineItems.length === 0 && invoice.totalAmount) {
      lineItems.push({
        description: invoice.fileName,
        quantity: 1,
        unitAmount: invoice.subtotal ?? invoice.totalAmount,
        taxType: 'NONE' as const,
        taxAmount: invoiceTax,
        accountCode: '200',
      });
    }

    const xeroInvoice: XeroInvoice = {
      type: XeroInvoice.TypeEnum.ACCPAY,
      contact: { name: invoice.vendorName ?? 'Unknown Vendor' } as Contact,
      lineItems,
      lineAmountTypes: LineAmountTypes.Exclusive,
      date: invoice.invoiceDate ?? undefined,
      dueDate: invoice.dueDate ?? undefined,
      invoiceNumber: invoice.invoiceNumber ?? undefined,
      currencyCode: invoice.currency ? (invoice.currency as unknown as CurrencyCode) : undefined,
      status: XeroInvoice.StatusEnum.DRAFT,
    };

    const response = await client.accountingApi.createInvoices(tenantId, { invoices: [xeroInvoice] });
    const createdInvoice = response.body.invoices?.[0];

    // Attach the original file to the Xero invoice (non-blocking — don't fail sync if attachment fails)
    if (createdInvoice?.invoiceID) {
      try {
        const file = await findInvoiceFile(invoiceId);
        if (file) {
          const ext = path.extname(file.fileName).toLowerCase();
          const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
          const fileBuffer = await fs.readFile(file.filePath);
          const attachmentName = invoice.fileName || file.fileName;

          await client.accountingApi.createInvoiceAttachmentByFileName(
            tenantId,
            createdInvoice.invoiceID,
            attachmentName,
            fileBuffer,
            true, // includeOnline
            undefined, // idempotencyKey
            { headers: { 'Content-Type': contentType } },
          );
          console.log(`Attached ${attachmentName} to Xero invoice ${createdInvoice.invoiceID}`);
        }
      } catch (attachErr) {
        console.warn(`Failed to attach file to Xero invoice (invoice still synced):`, attachErr);
      }
    }

    // Update local status to synced and store Xero invoice ID
    const updated = await updateInvoice(invoiceId, {
      status: InvoiceStatus.SYNCED,
      xeroInvoiceId: createdInvoice?.invoiceID ?? null,
    });
    if (updated) {
      broadcast({ type: 'invoice:updated', payload: updated });
    }

    res.json({
      message: 'Invoice synced to Xero',
      xeroInvoiceId: createdInvoice?.invoiceID,
    });
  } catch (err) {
    console.error('Xero sync error:', err);
    const message = err instanceof Error ? err.message : 'Failed to sync invoice to Xero';
    res.status(500).json({ error: message });
  }
});

export default router;
