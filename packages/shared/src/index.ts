export enum InvoiceStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  EXTRACTED = 'extracted',
  REVIEW = 'review',
  APPROVED = 'approved',
  SYNCED = 'synced',
  ERROR = 'error',
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  fileName: string;
  filePath: string;
  status: InvoiceStatus;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  taxRate: number | null;
  totalAmount: number | null;
  currency: string;
  rawText: string | null;
  confidence: number | null;
  errorMessage: string | null;
  xeroInvoiceId: string | null;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoicePayload {
  fileName: string;
  filePath: string;
}

export interface UpdateInvoicePayload {
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal?: number | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  totalAmount?: number | null;
  currency?: string;
  status?: InvoiceStatus;
  xeroInvoiceId?: string | null;
}

export type WSMessageType =
  | 'invoice:created'
  | 'invoice:updated'
  | 'invoice:processing'
  | 'invoice:extracted'
  | 'invoice:error';

export interface WSMessage {
  type: WSMessageType;
  payload: Invoice;
}

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  realmId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
