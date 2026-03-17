import { InvoiceStatus } from '@finance-automation/shared';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  [InvoiceStatus.PENDING]: { label: 'Pending', color: '#8b8fa3', bg: '#2a2e3d' },
  [InvoiceStatus.PROCESSING]: { label: 'Processing', color: '#3b82f6', bg: '#1e3a5f' },
  [InvoiceStatus.EXTRACTED]: { label: 'Extracted', color: '#22c55e', bg: '#14532d' },
  [InvoiceStatus.REVIEW]: { label: 'Review', color: '#f59e0b', bg: '#4a3728' },
  [InvoiceStatus.APPROVED]: { label: 'Approved', color: '#22c55e', bg: '#14532d' },
  [InvoiceStatus.SYNCED]: { label: 'Synced', color: '#6366f1', bg: '#312e81' },
  [InvoiceStatus.ERROR]: { label: 'Error', color: '#ef4444', bg: '#4c1d1d' },
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG[InvoiceStatus.PENDING];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: cfg.color,
          animation: status === InvoiceStatus.PROCESSING ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      {cfg.label}
    </span>
  );
}
