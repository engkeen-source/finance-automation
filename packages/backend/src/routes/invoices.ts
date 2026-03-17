import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config } from '../config.js';
import {
  listInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from '../services/invoice-repository.js';
import { broadcast } from '../services/websocket.js';
import type { InvoiceStatus, UpdateInvoicePayload } from '@finance-automation/shared';

const router = Router();

// File upload to inbox
const upload = multer({
  dest: config.inboxPath,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp'];
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// List invoices
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const status = req.query.status as InvoiceStatus | undefined;

  const { data, total } = await listInvoices(page, pageSize, status);
  res.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// Get single invoice
router.get('/:id', async (req: Request, res: Response) => {
  const invoice = await getInvoiceById(req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json(invoice);
});

// Upload invoice file
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Rename to original filename in inbox
  const dest = path.join(config.inboxPath, req.file.originalname);
  await fs.rename(req.file.path, dest);
  res.json({ message: 'File uploaded to inbox', fileName: req.file.originalname });
});

// Update invoice (manual edit of extracted fields)
router.patch('/:id', async (req: Request, res: Response) => {
  const updates: UpdateInvoicePayload = req.body;
  const invoice = await updateInvoice(req.params.id, updates);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  broadcast({ type: 'invoice:updated', payload: invoice });
  res.json(invoice);
});

// Approve invoice
router.post('/:id/approve', async (req: Request, res: Response) => {
  const invoice = await updateInvoice(req.params.id, { status: 'approved' as InvoiceStatus });
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  // Move file from storage to inbox/done
  try {
    const donePath = path.join(config.inboxPath, 'done');
    await fs.mkdir(donePath, { recursive: true });
    const storageFiles = await fs.readdir(config.storagePath).catch(() => []);
    const storageFile = storageFiles.find((f) => f.startsWith(invoice.id));
    if (storageFile) {
      const src = path.join(config.storagePath, storageFile);
      const dest = path.join(donePath, storageFile);
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    }
  } catch (err) {
    console.error('Failed to move file to done folder:', err);
  }

  broadcast({ type: 'invoice:updated', payload: invoice });
  res.json(invoice);
});

// Delete invoice
router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await deleteInvoice(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json({ message: 'Invoice deleted' });
});

// Serve stored file
router.get('/:id/file', async (req: Request, res: Response) => {
  const invoice = await getInvoiceById(req.params.id);
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  // Look in storage first, then inbox/done
  const dirs = [config.storagePath, path.join(config.inboxPath, 'done')];
  for (const dir of dirs) {
    const files = await fs.readdir(dir).catch(() => []);
    const match = files.find((f) => f.startsWith(invoice.id));
    if (match) {
      res.sendFile(path.join(dir, match));
      return;
    }
  }
  res.status(404).json({ error: 'File not found' });
});

export default router;
