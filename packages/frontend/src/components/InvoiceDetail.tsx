import { useState } from 'react';
import type { Invoice } from '@finance-automation/shared';
import { InvoiceStatus } from '@finance-automation/shared';
import { StatusBadge } from './StatusBadge.tsx';

interface Props {
  invoice: Invoice;
  onUpdate: (id: string, updates: Partial<Invoice>) => Promise<Invoice>;
  onApprove: (id: string) => Promise<Invoice>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function InvoiceDetail({ invoice, onUpdate, onApprove, onDelete, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncToXero = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/xero/sync/${invoice.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? 'Sync failed');
      }
    } catch {
      setSyncError('Failed to connect to server');
    } finally {
      setSyncing(false);
    }
  };
  const [form, setForm] = useState({
    vendorName: invoice.vendorName ?? '',
    invoiceNumber: invoice.invoiceNumber ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    dueDate: invoice.dueDate ?? '',
    subtotal: invoice.subtotal?.toString() ?? '',
    taxAmount: invoice.taxAmount?.toString() ?? '',
    taxRate: invoice.taxRate?.toString() ?? '',
    totalAmount: invoice.totalAmount?.toString() ?? '',
    currency: invoice.currency ?? 'USD',
  });

  const handleSave = async () => {
    await onUpdate(invoice.id, {
      vendorName: form.vendorName || null,
      invoiceNumber: form.invoiceNumber || null,
      invoiceDate: form.invoiceDate || null,
      dueDate: form.dueDate || null,
      subtotal: form.subtotal ? parseFloat(form.subtotal) : null,
      taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : null,
      taxRate: form.taxRate ? parseFloat(form.taxRate) : null,
      totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : null,
      currency: form.currency,
    });
    setEditing(false);
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 10px',
    color: 'var(--text)',
    width: 200,
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: 13,
  };

  const valueStyle: React.CSSProperties = {
    fontWeight: 500,
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 60,
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 28,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>{invoice.fileName}</h2>
            <StatusBadge status={invoice.status as InvoiceStatus} />
          </div>
          <button onClick={onClose} style={{ ...btnStyle, background: 'var(--bg)', color: 'var(--text-muted)' }}>
            Close
          </button>
        </div>

        <a
          href={`/api/invoices/${invoice.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginBottom: 16,
            padding: '8px 16px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          View Original File
        </a>

        {invoice.confidence !== null && (
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            OCR Confidence:{' '}
            <span style={{ color: invoice.confidence > 70 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
              {invoice.confidence.toFixed(1)}%
            </span>
          </div>
        )}

        {invoice.errorMessage && (
          <div
            style={{
              background: '#4c1d1d',
              color: 'var(--error)',
              padding: 12,
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {invoice.errorMessage}
          </div>
        )}

        <div style={fieldStyle}>
          <span style={labelStyle}>Vendor</span>
          {editing ? (
            <input
              style={inputStyle}
              value={form.vendorName}
              onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
            />
          ) : (
            <span style={valueStyle}>{invoice.vendorName ?? '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Invoice #</span>
          {editing ? (
            <input
              style={inputStyle}
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          ) : (
            <span style={valueStyle}>{invoice.invoiceNumber ?? '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Invoice Date</span>
          {editing ? (
            <input
              style={inputStyle}
              type="date"
              value={form.invoiceDate}
              onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
            />
          ) : (
            <span style={valueStyle}>{invoice.invoiceDate ?? '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Due Date</span>
          {editing ? (
            <input
              style={inputStyle}
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          ) : (
            <span style={valueStyle}>{invoice.dueDate ?? '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Subtotal</span>
          {editing ? (
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              value={form.subtotal}
              onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))}
            />
          ) : (
            <span style={valueStyle}>{invoice.subtotal != null ? `$${invoice.subtotal.toFixed(2)}` : '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>
            Tax{invoice.taxRate != null ? ` (${invoice.taxRate}%)` : ''}
          </span>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, width: 80 }}
                type="number"
                step="0.01"
                value={form.taxRate}
                onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                placeholder="%"
              />
              <input
                style={{ ...inputStyle, width: 110 }}
                type="number"
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))}
                placeholder="Amount"
              />
            </div>
          ) : (
            <span style={valueStyle}>{invoice.taxAmount != null ? `$${invoice.taxAmount.toFixed(2)}` : '—'}</span>
          )}
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>Total</span>
          {editing ? (
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
            />
          ) : (
            <span style={{ ...valueStyle, fontSize: 18, color: 'var(--primary)' }}>
              {invoice.totalAmount != null ? `$${invoice.totalAmount.toFixed(2)}` : '—'}
            </span>
          )}
        </div>

        {invoice.lineItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-muted)' }}>Line Items</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 0' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 0' }}>{item.description}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '8px' }}>${item.unitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>${item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                style={{ ...btnStyle, background: 'var(--bg)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ ...btnStyle, background: 'var(--primary)', color: '#fff' }}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onDelete(invoice.id).then(onClose)}
                style={{ ...btnStyle, background: '#4c1d1d', color: 'var(--error)' }}
              >
                Delete
              </button>
              <button
                onClick={() => setEditing(true)}
                style={{ ...btnStyle, background: 'var(--bg)', color: 'var(--text)' }}
              >
                Edit
              </button>
              {invoice.status === InvoiceStatus.REVIEW && (
                <button
                  onClick={() => onApprove(invoice.id)}
                  style={{ ...btnStyle, background: 'var(--success)', color: '#fff' }}
                >
                  Approve
                </button>
              )}
              {invoice.status === InvoiceStatus.APPROVED && (
                <button
                  onClick={handleSyncToXero}
                  disabled={syncing}
                  style={{
                    ...btnStyle,
                    background: '#13B5EA',
                    color: '#fff',
                    opacity: syncing ? 0.6 : 1,
                  }}
                >
                  {syncing ? 'Syncing...' : 'Sync to Xero'}
                </button>
              )}
              {invoice.status === InvoiceStatus.SYNCED && invoice.xeroInvoiceId && (
                <a
                  href={`https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=${invoice.xeroInvoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...btnStyle,
                    background: '#13B5EA',
                    color: '#fff',
                    textDecoration: 'none',
                    display: 'inline-block',
                  }}
                >
                  View in Xero
                </a>
              )}
            </>
          )}
        </div>
        {syncError && (
          <div style={{ color: 'var(--error)', fontSize: 13, marginTop: 8, textAlign: 'right' }}>
            {syncError}
          </div>
        )}
      </div>
    </div>
  );
}
