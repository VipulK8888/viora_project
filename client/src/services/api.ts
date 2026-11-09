import {
  Invoice,
  SystemHealth,
  DashboardSummary,
  Customer,
  Product,
  PaymentRecord,
  BusinessProfile,
  ReminderQueueData,
  ReminderLogItem,
  ReminderCadenceConfig,
  SalesReportData,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { status: 'unhealthy' };
    const json = await res.json();
    return {
      status: json.data?.status === 'healthy' ? 'healthy' : 'unhealthy',
      service: json.data?.service,
      version: json.data?.version,
      environment: json.data?.environment,
      database: json.data?.database,
    };
  } catch {
    return { status: 'offline' };
  }
}

// -------------------------------------------------------------
// Dashboard & Reports API
// -------------------------------------------------------------
export async function fetchDashboardSummary(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<DashboardSummary | null> {
  try {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    const queryString = query.toString();
    const url = queryString ? `${API_BASE}/dashboard/summary?${queryString}` : `${API_BASE}/dashboard/summary`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load dashboard summary');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('Dashboard summary fetch failed, using fallback metrics', err);
    return null;
  }
}

export async function fetchSalesReport(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'month';
}): Promise<SalesReportData> {
  const query = new URLSearchParams();
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.groupBy) query.append('groupBy', params.groupBy);

  const res = await fetch(`${API_BASE}/reports/sales?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load sales report');
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Invoices API
// -------------------------------------------------------------
export async function fetchInvoices(params?: {
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ invoices: Invoice[]; totalCount: number; totalPages: number; isBackendConnected: boolean }> {
  try {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.paymentStatus && params.paymentStatus !== 'ALL') query.append('paymentStatus', params.paymentStatus);
    if (params?.customerId && params.customerId !== 'ALL') query.append('customerId', params.customerId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
    if (!res.ok) throw new Error('API response not ok');
    const json = await res.json();
    return {
      invoices: json.data?.invoices || [],
      totalCount: json.data?.pagination?.totalCount || 0,
      totalPages: json.data?.pagination?.totalPages || 1,
      isBackendConnected: true,
    };
  } catch (err) {
    console.warn('Invoices fetch failed', err);
    return {
      invoices: [],
      totalCount: 0,
      totalPages: 1,
      isBackendConnected: false,
    };
  }
}

export async function deleteDraftInvoice(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete draft invoice');
  }
}

export async function cancelInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to cancel invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function fetchInvoiceDetails(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to fetch invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function createInvoice(data: {
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply?: string;
  isInterState?: boolean;
  notes?: string;
  items: Array<{
    productId?: string | null;
    descriptionSnapshot: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate?: number;
  }>;
}): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function updateDraftInvoice(
  id: string,
  data: {
    customerId: string;
    invoiceDate: string;
    dueDate: string;
    placeOfSupply?: string;
    isInterState?: boolean;
    notes?: string;
    items: Array<{
      productId?: string | null;
      descriptionSnapshot: string;
      unit?: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      taxRate?: number;
    }>;
  }
): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update draft invoice');
  }
  const json = await res.json();
  return json.data;
}

export async function issueInvoice(id: string): Promise<Invoice> {
  const res = await fetch(`${API_BASE}/invoices/${id}/issue`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to issue invoice');
  }
  const json = await res.json();
  return json.data;
}

export function getInvoicePdfUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/pdf`;
}

export async function downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${id}/pdf`);
  if (!res.ok) {
    throw new Error('Failed to download invoice PDF');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoiceNumber || 'document'}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function recordInvoicePayment(
  invoiceId: string,
  data: {
    amount: number;
    paymentDate?: string;
    method: string;
    reference?: string;
    requestKey: string;
  }
): Promise<{
  payment: PaymentRecord;
  invoiceSummary: {
    totalPaid: number;
    balanceRemaining: number;
    paymentStatus: string;
  };
}> {
  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Payment recording failed');
  }
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Customers API
// -------------------------------------------------------------
export async function fetchCustomers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ customers: Customer[]; totalCount: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/customers?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  const json = await res.json();
  return {
    customers: json.data?.customers || [],
    totalCount: json.data?.pagination?.totalCount || 0,
  };
}

export async function createCustomer(data: {
  name: string;
  phone: string;
  email?: string;
  billingAddress: string;
  gstin?: string;
}): Promise<Customer> {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create customer');
  }
  const json = await res.json();
  return json.data;
}

export async function updateCustomer(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    email?: string;
    billingAddress: string;
    gstin?: string;
  }>
): Promise<Customer> {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update customer');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteCustomer(id: string): Promise<{
  success: boolean;
  message?: string;
  data?: { id: string; isArchived?: boolean; deleted?: boolean };
}> {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete customer');
  }
  return res.json();
}

// -------------------------------------------------------------
// Products API
// -------------------------------------------------------------
export async function fetchProducts(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ products: Product[]; totalCount: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/products?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  const json = await res.json();
  return {
    products: json.data?.products || [],
    totalCount: json.data?.pagination?.totalCount || 0,
  };
}

export async function createProduct(data: {
  name: string;
  description?: string;
  unit: string;
  unitPrice: number;
  taxRate: number;
  isActive?: boolean;
}): Promise<Product> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create product');
  }
  const json = await res.json();
  return json.data;
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description?: string;
    unit: string;
    unitPrice: number;
    taxRate: number;
    isActive?: boolean;
  }>
): Promise<Product> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update product');
  }
  const json = await res.json();
  return json.data;
}

export async function deleteProduct(id: string): Promise<{
  success: boolean;
  message?: string;
  data?: { id: string; isArchived?: boolean; deleted?: boolean };
}> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete product');
  }
  return res.json();
}

// -------------------------------------------------------------
// Payments API
// -------------------------------------------------------------
export async function fetchPayments(params?: {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  invoiceId?: string;
  customerId?: string;
}): Promise<{ payments: PaymentRecord[]; totalCount: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.method && params.method !== 'ALL') query.append('method', params.method);
  if (params?.invoiceId) query.append('invoiceId', params.invoiceId);
  if (params?.customerId) query.append('customerId', params.customerId);

  const res = await fetch(`${API_BASE}/payments?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  const json = await res.json();
  return {
    payments: json.data?.payments || [],
    totalCount: json.data?.pagination?.totalCount || 0,
  };
}

// -------------------------------------------------------------
// Business Profile API
// -------------------------------------------------------------
export async function fetchBusiness(): Promise<BusinessProfile> {
  const res = await fetch(`${API_BASE}/business`);
  if (!res.ok) throw new Error('Failed to fetch business details');
  const json = await res.json();
  return json.data;
}

export async function updateBusiness(data: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const res = await fetch(`${API_BASE}/business`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update business');
  }
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// Automated Reminders API
// -------------------------------------------------------------
export async function fetchReminderQueue(): Promise<ReminderQueueData> {
  const res = await fetch(`${API_BASE}/reminders/queue`);
  if (!res.ok) throw new Error('Failed to load automated reminder queue');
  const json = await res.json();
  return json.data;
}

export async function fetchReminderLogs(limit = 50): Promise<ReminderLogItem[]> {
  const res = await fetch(`${API_BASE}/reminders/logs?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load reminder audit logs');
  const json = await res.json();
  return json.data;
}

export async function runAutomatedReminders(): Promise<{
  totalEvaluated: number;
  dueProcessed: number;
  skippedCooldown: number;
  results: Array<Record<string, unknown>>;
}> {
  const res = await fetch(`${API_BASE}/reminders/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to execute automated reminders sweep');
  }
  const json = await res.json();
  return json.data;
}

export async function sendInvoiceWhatsAppReminder(invoiceId: string): Promise<{
  success: boolean;
  channel: string;
  recipient: string;
  whatsAppUrl: string;
  messageContent: string;
  tier: string;
  daysGapApplied: number;
  nextEligibleAt: string;
}> {
  const res = await fetch(`${API_BASE}/reminders/invoices/${invoiceId}/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to dispatch WhatsApp reminder');
  }
  const json = await res.json();
  return json.data;
}

export async function sendInvoiceEmailReminder(invoiceId: string): Promise<{
  success: boolean;
  channel: string;
  recipient: string;
  subject: string;
  tier: string;
  daysGapApplied: number;
  nextEligibleAt: string;
  previewUrl?: string | null;
  logId?: string;
  isLiveSmtp?: boolean;
  provider?: string;
}> {
  const res = await fetch(`${API_BASE}/reminders/invoices/${invoiceId}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to dispatch email reminder');
  }
  const json = await res.json();
  return json.data;
}

export async function sendInvoiceBothReminders(invoiceId: string): Promise<{
  success: boolean;
  results?: {
    whatsapp?: { success: boolean; logId?: string; whatsAppUrl?: string; error?: string };
    email?: { success: boolean; logId?: string; previewUrl?: string | null; error?: string };
  };
}> {
  const res = await fetch(`${API_BASE}/reminders/invoices/${invoiceId}/both`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to dispatch reminders');
  }
  const json = await res.json();
  return json.data;
}

export async function updateReminderConfig(config: Partial<ReminderCadenceConfig>): Promise<ReminderCadenceConfig> {
  const res = await fetch(`${API_BASE}/reminders/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to update reminder settings');
  }
  const json = await res.json();
  return json.data;
}

export async function testReminderSimulation(params: {
  phone?: string;
  email?: string;
  amount?: number;
  customerName?: string;
  invoiceNumber?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/reminders/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to generate test reminder');
  }
  const json = await res.json();
  return json.data;
}

export async function testSmtpConnection(settings: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  testEmail?: string;
}): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
  isLiveSmtp: boolean;
  provider: string;
}> {
  const res = await fetch(`${API_BASE}/reminders/smtp-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'SMTP Connection Test Failed');
  }
  const json = await res.json();
  return json.data;
}

