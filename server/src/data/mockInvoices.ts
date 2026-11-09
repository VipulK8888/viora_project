/**
 * Phase 1 Preview Mock Data
 * NOTE: These records are strictly mock data designed for frontend preview and verification.
 * They are not real financial records. Real database records will be managed in Phase 2 via PostgreSQL.
 */

export interface MockInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'DRAFT';
  currency: string;
  isMock: true;
}

export const MOCK_INVOICES: MockInvoice[] = [
  {
    id: 'mock-inv-001',
    invoiceNumber: 'INV-2025-001',
    customerName: 'Acme Technologies Pvt Ltd',
    customerEmail: 'billing@acmetech.in',
    issueDate: '2025-10-15',
    dueDate: '2025-10-30',
    amount: 145000,
    status: 'PAID',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-002',
    invoiceNumber: 'INV-2025-002',
    customerName: 'NexGen Digital Solutions',
    customerEmail: 'accounts@nexgendigital.com',
    issueDate: '2025-10-18',
    dueDate: '2025-11-02',
    amount: 88500,
    status: 'PENDING',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-003',
    invoiceNumber: 'INV-2025-003',
    customerName: 'Horizon Global Logistics',
    customerEmail: 'finance@horizonglobal.com',
    issueDate: '2025-09-28',
    dueDate: '2025-10-12',
    amount: 215000,
    status: 'OVERDUE',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-004',
    invoiceNumber: 'INV-2025-004',
    customerName: 'Zenith Retail Corporation',
    customerEmail: 'payables@zenithretail.in',
    issueDate: '2025-10-20',
    dueDate: '2025-11-05',
    amount: 54000,
    status: 'PAID',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-005',
    invoiceNumber: 'INV-2025-005',
    customerName: 'BlueSky Cloud Services',
    customerEmail: 'admin@blueskycloud.io',
    issueDate: '2025-10-22',
    dueDate: '2025-11-06',
    amount: 120500,
    status: 'PENDING',
    currency: 'INR',
    isMock: true,
  },
  {
    id: 'mock-inv-006',
    invoiceNumber: 'INV-2025-006',
    customerName: 'Vertex AI Innovations',
    customerEmail: 'billing@vertexai.co',
    issueDate: '2025-10-23',
    dueDate: '2025-11-07',
    amount: 72000,
    status: 'DRAFT',
    currency: 'INR',
    isMock: true,
  },
];

export const MOCK_METRICS = {
  isMock: true,
  currency: 'INR',
  totalSales: {
    amount: 1248500,
    changePercentage: 14.2,
    trend: 'up',
    period: 'vs last month',
  },
  totalInvoices: {
    count: 142,
    paidCount: 114,
    pendingCount: 20,
    overdueCount: 8,
  },
  amountCollected: {
    amount: 985200,
    collectionRate: 78.9,
    trend: 'up',
  },
  outstandingPayments: {
    amount: 263300,
    overdueAmount: 85000,
    riskLevel: 'Moderate',
  },
};
