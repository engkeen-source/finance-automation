import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import { createInvoice, updateInvoice, addLineItems, getInvoiceById } from '../services/invoice-repository.js';
import { processFile } from '../services/ocr.js';
import { broadcast } from '../services/websocket.js';
import { InvoiceStatus } from '@finance-automation/shared';

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp']);

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function handleNewFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    console.log(`Skipping unsupported file: ${filePath}`);
    return;
  }

  const fileName = path.basename(filePath);
  console.log(`New invoice detected: ${fileName}`);

  // Create invoice record
  const invoice = await createInvoice(fileName, filePath);
  broadcast({ type: 'invoice:created', payload: invoice });

  // Move file to storage
  await ensureDir(config.storagePath);
  const storageDest = path.join(config.storagePath, `${invoice.id}${ext}`);
  await fs.copyFile(filePath, storageDest);

  // Update status to processing
  const processing = await updateInvoice(invoice.id, { status: InvoiceStatus.PROCESSING });
  if (processing) broadcast({ type: 'invoice:processing', payload: processing });

  try {
    // Extract data
    const result = await processFile(storageDest);

    // Save extracted data
    await addLineItems(invoice.id, result.lineItems);
    const extracted = await updateInvoice(invoice.id, {
      status: InvoiceStatus.REVIEW,
      vendorName: result.vendorName,
      invoiceNumber: result.invoiceNumber,
      invoiceDate: result.invoiceDate,
      dueDate: result.dueDate,
      subtotal: result.subtotal,
      taxAmount: result.taxAmount,
      taxRate: result.taxRate,
      totalAmount: result.totalAmount,
      currency: result.currency,
      rawText: result.rawText,
      confidence: result.confidence,
    });

    if (extracted) broadcast({ type: 'invoice:extracted', payload: extracted });
    console.log(`Invoice ${fileName} processed successfully (confidence: ${result.confidence.toFixed(1)}%)`);

    // Remove from inbox after successful processing
    await fs.unlink(filePath).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing ${fileName}:`, message);
    const errored = await updateInvoice(invoice.id, {
      status: InvoiceStatus.ERROR,
      errorMessage: message,
    });
    if (errored) broadcast({ type: 'invoice:error', payload: errored });
  }
}

export function startInboxWatcher(): void {
  console.log(`Watching inbox: ${config.inboxPath}`);

  const watcher = chokidar.watch(config.inboxPath, {
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
    ignored: [/(^|[\/\\])\.\./, path.join(config.inboxPath, 'done')], // ignore dotfiles and done folder
    depth: 0,
  });

  watcher.on('add', (filePath) => {
    handleNewFile(filePath).catch((err) => {
      console.error('Watcher error:', err);
    });
  });

  watcher.on('error', (err) => {
    console.error('Watcher error:', err);
  });
}
