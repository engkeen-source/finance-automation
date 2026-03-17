import { useState, useCallback } from 'react';
import type { Invoice, InvoiceStatus, WSMessage } from '@finance-automation/shared';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useInvoices } from './hooks/useInvoices.ts';
import { FileUpload } from './components/FileUpload.tsx';
import { InvoiceList } from './components/InvoiceList.tsx';
import { InvoiceDetail } from './components/InvoiceDetail.tsx';
import { XeroConnect } from './components/XeroConnect.tsx';

const STATUS_TABS: Array<{ label: string; value: InvoiceStatus | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Review', value: 'review' as InvoiceStatus },
  { label: 'Approved', value: 'approved' as InvoiceStatus },
  { label: 'Processing', value: 'processing' as InvoiceStatus },
  { label: 'Synced', value: 'synced' as InvoiceStatus },
  { label: 'Error', value: 'error' as InvoiceStatus },
];

export default function App() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>(undefined);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const {
    invoices,
    loading,
    total,
    upsertInvoice,
    updateInvoice,
    approveInvoice,
    deleteInvoice,
  } = useInvoices(statusFilter);

  const handleWSMessage = useCallback(
    (msg: WSMessage) => {
      upsertInvoice(msg.payload);
      // If viewing this invoice, update the detail view too
      if (selected?.id === msg.payload.id) {
        setSelected(msg.payload);
      }
    },
    [upsertInvoice, selected]
  );

  useWebSocket(handleWSMessage);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Invoice Processing
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {total} invoice{total !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Xero connection + Upload */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <FileUpload />
        </div>
        <div style={{ flex: 1 }}>
          <XeroConnect />
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              background: statusFilter === tab.value ? 'var(--primary)' : 'var(--bg-card)',
              color: statusFilter === tab.value ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <InvoiceList invoices={invoices} loading={loading} onSelect={setSelected} />

      {/* Detail modal */}
      {selected && (
        <InvoiceDetail
          invoice={selected}
          onUpdate={updateInvoice}
          onApprove={approveInvoice}
          onDelete={deleteInvoice}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
