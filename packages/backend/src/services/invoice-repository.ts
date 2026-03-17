import { pool } from '../db/pool.js';
import type { Invoice, InvoiceLineItem, InvoiceStatus, UpdateInvoicePayload } from '@finance-automation/shared';

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    fileName: row.file_name as string,
    filePath: row.file_path as string,
    status: row.status as InvoiceStatus,
    vendorName: row.vendor_name as string | null,
    invoiceNumber: row.invoice_number as string | null,
    invoiceDate: row.invoice_date ? (row.invoice_date as Date).toISOString().split('T')[0] : null,
    dueDate: row.due_date ? (row.due_date as Date).toISOString().split('T')[0] : null,
    subtotal: row.subtotal ? parseFloat(row.subtotal as string) : null,
    taxAmount: row.tax_amount ? parseFloat(row.tax_amount as string) : null,
    taxRate: row.tax_rate ? parseFloat(row.tax_rate as string) : null,
    totalAmount: row.total_amount ? parseFloat(row.total_amount as string) : null,
    currency: row.currency as string,
    rawText: row.raw_text as string | null,
    confidence: row.confidence ? parseFloat(row.confidence as string) : null,
    errorMessage: row.error_message as string | null,
    xeroInvoiceId: row.xero_invoice_id as string | null,
    lineItems: [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function rowToLineItem(row: Record<string, unknown>): InvoiceLineItem {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    description: row.description as string,
    quantity: parseFloat(row.quantity as string),
    unitPrice: parseFloat(row.unit_price as string),
    amount: parseFloat(row.amount as string),
  };
}

export async function createInvoice(fileName: string, filePath: string): Promise<Invoice> {
  const { rows } = await pool.query(
    'INSERT INTO invoices (file_name, file_path, status) VALUES ($1, $2, $3) RETURNING *',
    [fileName, filePath, 'pending']
  );
  return rowToInvoice(rows[0]);
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (rows.length === 0) return null;

  const invoice = rowToInvoice(rows[0]);
  const { rows: lineRows } = await pool.query(
    'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at',
    [id]
  );
  invoice.lineItems = lineRows.map(rowToLineItem);
  return invoice;
}

export async function listInvoices(
  page = 1,
  pageSize = 20,
  status?: InvoiceStatus
): Promise<{ data: Invoice[]; total: number }> {
  const offset = (page - 1) * pageSize;
  let query = 'SELECT * FROM invoices';
  let countQuery = 'SELECT COUNT(*) FROM invoices';
  const params: unknown[] = [];
  const countParams: unknown[] = [];

  if (status) {
    query += ' WHERE status = $1';
    countQuery += ' WHERE status = $1';
    params.push(status);
    countParams.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(pageSize, offset);

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, countParams),
  ]);

  const invoices = rows.map(rowToInvoice);

  // Fetch line items for all invoices
  if (invoices.length > 0) {
    const ids = invoices.map((i) => i.id);
    const { rows: lineRows } = await pool.query(
      `SELECT * FROM invoice_line_items WHERE invoice_id = ANY($1) ORDER BY created_at`,
      [ids]
    );
    const lineItemsByInvoice = new Map<string, InvoiceLineItem[]>();
    for (const row of lineRows) {
      const item = rowToLineItem(row);
      const existing = lineItemsByInvoice.get(item.invoiceId) ?? [];
      existing.push(item);
      lineItemsByInvoice.set(item.invoiceId, existing);
    }
    for (const invoice of invoices) {
      invoice.lineItems = lineItemsByInvoice.get(invoice.id) ?? [];
    }
  }

  return { data: invoices, total: parseInt(countRows[0].count as string, 10) };
}

export async function updateInvoice(id: string, updates: UpdateInvoicePayload & {
  rawText?: string;
  confidence?: number;
  errorMessage?: string;
}): Promise<Invoice | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, string> = {
    vendorName: 'vendor_name',
    invoiceNumber: 'invoice_number',
    invoiceDate: 'invoice_date',
    dueDate: 'due_date',
    subtotal: 'subtotal',
    taxAmount: 'tax_amount',
    taxRate: 'tax_rate',
    totalAmount: 'total_amount',
    currency: 'currency',
    status: 'status',
    rawText: 'raw_text',
    confidence: 'confidence',
    errorMessage: 'error_message',
    xeroInvoiceId: 'xero_invoice_id',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      fields.push(`${col} = $${idx}`);
      values.push((updates as Record<string, unknown>)[key]);
      idx++;
    }
  }

  if (fields.length === 0) return getInvoiceById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  await pool.query(
    `UPDATE invoices SET ${fields.join(', ')} WHERE id = $${idx}`,
    values
  );

  return getInvoiceById(id);
}

export async function addLineItems(
  invoiceId: string,
  items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>
): Promise<void> {
  if (items.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  items.forEach((item, i) => {
    const base = i * 5;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    values.push(invoiceId, item.description, item.quantity, item.unitPrice, item.amount);
  });

  await pool.query(
    `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount) VALUES ${placeholders.join(', ')}`,
    values
  );
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM invoices WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
