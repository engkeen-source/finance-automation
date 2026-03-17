import { useState, useEffect } from 'react';

interface XeroStatus {
  connected: boolean;
  orgName?: string;
}

export function XeroConnect() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/xero/status');
      const data: XeroStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Check URL params for callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('xero') === 'connected') {
      fetchStatus();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('xero') === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    const res = await fetch('/api/xero/connect');
    const { url } = await res.json();
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    await fetch('/api/xero/disconnect', { method: 'POST' });
    setStatus({ connected: false });
  };

  if (loading) return null;

  const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  };

  if (status?.connected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--success)',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Xero Connected</div>
          {status.orgName && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{status.orgName}</div>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          style={{
            ...btnStyle,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Xero</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connect to sync invoices</div>
      </div>
      <button
        onClick={handleConnect}
        style={{
          ...btnStyle,
          background: '#13B5EA',
          color: '#fff',
          border: 'none',
        }}
      >
        Connect to Xero
      </button>
    </div>
  );
}
