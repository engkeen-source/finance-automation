import type { Invoice } from '@finance-automation/shared';
import { InvoiceStatus } from '@finance-automation/shared';
import { StatusBadge } from './StatusBadge.tsx';

interface Props {
  invoices: Invoice[];
  loading: boolean;
  onSelect: (invoice: Invoice) => void;
}

export function InvoiceList({ invoices, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        Loading invoices...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>No invoices yet</div>
        <div style={{ fontSize: 14 }}>
          Drop a PDF or image into the inbox folder, or use the upload area above.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
          padding: '10px 16px',
          fontSize: 12,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600,
        }}
      >
        <span>File</span>
        <span>Vendor</span>
        <span>Amount</span>
        <span>Status</span>
        <span style={{ textAlign: 'right' }}>Date</span>
      </div>

      {invoices.map((inv) => (
        <div
          key={inv.id}
          onClick={() => onSelect(inv)}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
            padding: '14px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
        >
          <span
            style={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {inv.fileName}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{inv.vendorName ?? '—'}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {inv.totalAmount != null ? `$${inv.totalAmount.toFixed(2)}` : '—'}
          </span>
          <StatusBadge status={inv.status as InvoiceStatus} />
          <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 13 }}>
            {new Date(inv.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
