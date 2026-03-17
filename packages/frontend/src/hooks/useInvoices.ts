import { useState, useEffect, useCallback } from 'react';
import type { Invoice, PaginatedResponse, InvoiceStatus } from '@finance-automation/shared';

const API_BASE = '/api/invoices';

export function useInvoices(statusFilter?: InvoiceStatus) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}?${params}`);
      const data: PaginatedResponse<Invoice> = await res.json();
      setInvoices(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const upsertInvoice = useCallback((invoice: Invoice) => {
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === invoice.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = invoice;
        return next;
      }
      return [invoice, ...prev];
    });
  }, []);

  const updateInvoice = useCallback(async (id: string, updates: Partial<Invoice>) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const updated: Invoice = await res.json();
    upsertInvoice(updated);
    return updated;
  }, [upsertInvoice]);

  const approveInvoice = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE}/${id}/approve`, { method: 'POST' });
    const updated: Invoice = await res.json();
    upsertInvoice(updated);
    return updated;
  }, [upsertInvoice]);

  const deleteInvoice = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    invoices,
    loading,
    total,
    page,
    setPage,
    fetchInvoices,
    upsertInvoice,
    updateInvoice,
    approveInvoice,
    deleteInvoice,
  };
}
