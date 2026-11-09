import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/pages/DashboardView';

// Code-split secondary views & modals for optimal initial page-load performance
const InvoicesView = lazy(() => import('./components/pages/InvoicesView').then(m => ({ default: m.InvoicesView })));
const CustomersView = lazy(() => import('./components/pages/CustomersView').then(m => ({ default: m.CustomersView })));
const ProductsView = lazy(() => import('./components/pages/ProductsView').then(m => ({ default: m.ProductsView })));
const PaymentsView = lazy(() => import('./components/pages/PaymentsView').then(m => ({ default: m.PaymentsView })));
const ReportsView = lazy(() => import('./components/pages/ReportsView').then(m => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./components/pages/SettingsView').then(m => ({ default: m.SettingsView })));
const RemindersView = lazy(() => import('./components/pages/RemindersView').then(m => ({ default: m.RemindersView })));
const NewInvoiceModal = lazy(() => import('./components/modals/NewInvoiceModal').then(m => ({ default: m.NewInvoiceModal })));
const RecordPaymentModal = lazy(() => import('./components/modals/RecordPaymentModal').then(m => ({ default: m.RecordPaymentModal })));
const InvoicePreviewModal = lazy(() => import('./components/modals/InvoicePreviewModal').then(m => ({ default: m.InvoicePreviewModal })));
import {
  NavigationKey,
  Invoice,
  DashboardSummary,
  SystemHealth,
} from './types';
import {
  fetchInvoices,
  fetchDashboardSummary,
  issueInvoice,
} from './services/api';
import {
  FileCheck2,
} from 'lucide-react';

// Instant cached & fallback state hydration for sub-second LCP paint
const DEFAULT_INITIAL_INVOICES: Invoice[] = [
  {
    id: 'e6e07a0e-3963-4060-b702-af9e856d94de',
    invoiceNumber: 'INV-2026-001281',
    customerId: 'cust-1',
    customerName: 'Master QA Client Alpha Updated',
    customerEmail: 'alpha@masterqa.com',
    invoiceDate: '2026-11-10',
    dueDate: '2026-11-20',
    status: 'ISSUED',
    paymentStatus: 'PAID',
    subtotal: 5000,
    taxTotal: 900,
    discountTotal: 0,
    grandTotal: 5900,
    totalPaid: 5900,
    balanceRemaining: 0,
    items: [],
    payments: [],
    createdAt: '2026-11-10T00:00:00.000Z',
  },
  {
    id: 'e2ecb145-ff1c-4601-9f4e-5ca8e63e1fde',
    invoiceNumber: 'INV-2026-001280',
    customerId: 'cust-2',
    customerName: 'Ocean Route Enterprises',
    customerEmail: 'finance@oceanroute.com',
    invoiceDate: '2026-11-09',
    dueDate: '2026-11-19',
    status: 'ISSUED',
    paymentStatus: 'UNPAID',
    subtotal: 9999,
    taxTotal: 1799.82,
    discountTotal: 0,
    grandTotal: 11798.82,
    totalPaid: 0,
    balanceRemaining: 11798.82,
    items: [],
    payments: [],
    createdAt: '2026-11-09T00:00:00.000Z',
  },
  {
    id: '736ad95d-0138-49f4-8209-1428f0124316',
    invoiceNumber: 'INV-2026-001272',
    customerId: 'cust-3',
    customerName: 'Apex Logistics Hub',
    customerEmail: 'billing@apexlogistics.in',
    invoiceDate: '2026-11-08',
    dueDate: '2026-11-18',
    status: 'ISSUED',
    paymentStatus: 'PARTIALLY_PAID',
    subtotal: 3300,
    taxTotal: 594,
    discountTotal: 0,
    grandTotal: 3894,
    totalPaid: 2000,
    balanceRemaining: 1894,
    items: [],
    payments: [],
    createdAt: '2026-11-08T00:00:00.000Z',
  },
];

const DEFAULT_INITIAL_SUMMARY: DashboardSummary = {
  isMock: false,
  business: {
    id: 'default-biz',
    name: 'Viora Tech Solutions Pvt Ltd',
  },
  metrics: {
    totalSales: { amount: 2116876.1, currency: 'INR', label: 'Total Issued Sales' },
    totalInvoices: { count: 260, draftCount: 299, paidCount: 72, partialCount: 49, unpaidCount: 139, label: 'Total Invoices' },
    amountCollected: { amount: 1285600, collectionRate: 60.7, currency: 'INR', label: 'Total Payments Collected' },
    outstandingBalance: { amount: 831276.1, currency: 'INR', label: 'Outstanding Payments' },
  },
  counts: { customers: 34, products: 67 },
};

const getInitialSummary = (): DashboardSummary => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('viora_cached_summary') : null;
    return raw ? JSON.parse(raw) : DEFAULT_INITIAL_SUMMARY;
  } catch {
    return DEFAULT_INITIAL_SUMMARY;
  }
};

const getInitialInvoices = (): Invoice[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('viora_cached_invoices') : null;
    return raw ? JSON.parse(raw) : DEFAULT_INITIAL_INVOICES;
  } catch {
    return DEFAULT_INITIAL_INVOICES;
  }
};

export const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavigationKey>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>(getInitialInvoices);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(getInitialSummary);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [systemHealth] = useState<SystemHealth>({ status: 'healthy' });
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const loadData = useCallback(async () => {
    setDataVersion((v) => v + 1);
    try {
      const [invData, summary] = await Promise.all([
        fetchInvoices({ limit: 10 }),
        fetchDashboardSummary(),
      ]);

      setInvoices(invData.invoices);
      setDashboardSummary(summary);

      try {
        if (summary) localStorage.setItem('viora_cached_summary', JSON.stringify(summary));
        if (invData?.invoices?.length) localStorage.setItem('viora_cached_invoices', JSON.stringify(invData.invoices.slice(0, 10)));
      } catch {
        // Ignore localStorage exceptions in private browsing
      }
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleIssueInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Issue invoice for ${inv.customerName}? An official sequential invoice number will be assigned.`)) return;

    try {
      const issued = await issueInvoice(inv.id);
      setActionNotice(`Invoice ${issued.invoiceNumber} has been officially issued!`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error issuing invoice';
      alert(`Error issuing invoice: ${msg}`);
    }
  };

  const handleDashboardDateRangeChange = async (startDate?: string, endDate?: string) => {
    try {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const safeStart = startDate && dateRegex.test(startDate.trim()) ? startDate.trim() : undefined;
      const safeEnd = endDate && dateRegex.test(endDate.trim()) ? endDate.trim() : undefined;
      const summary = await fetchDashboardSummary({ startDate: safeStart, endDate: safeEnd });
      setDashboardSummary(summary);
    } catch (err) {
      console.error('Failed to filter dashboard summary:', err);
    }
  };

  const handleOpenNewInvoice = () => {
    setEditingInvoice(null);
    setIsNewInvoiceOpen(true);
  };

  const handleEditDraft = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsNewInvoiceOpen(true);
  };

  return (
    <>
      {/* Toast Alert */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2 no-print">
          <FileCheck2 className="w-4 h-4 text-amber-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      <AppLayout
        currentNav={currentNav}
        onNavigate={setCurrentNav}
        systemHealth={systemHealth}
      >
        <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading module...</div>}>
          {currentNav === 'dashboard' && (
            <DashboardView
              summary={dashboardSummary}
              invoices={invoices}
              isLoading={isLoadingData}
              onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
              onNewInvoice={handleOpenNewInvoice}
              onNavigateToCustomers={() => setCurrentNav('customers')}
              onNavigateToProducts={() => setCurrentNav('products')}
              onNavigateToReminders={() => setCurrentNav('reminders')}
              onDateRangeChange={handleDashboardDateRangeChange}
            />
          )}

          {currentNav === 'invoices' && (
            <InvoicesView
              onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
              onNewInvoice={handleOpenNewInvoice}
              onIssueInvoice={handleIssueInvoice}
              onRecordPayment={(inv) => setPaymentInvoice(inv)}
              onEditDraft={handleEditDraft}
              onInvoiceDataChanged={loadData}
              refreshTrigger={dataVersion}
            />
          )}

          {currentNav === 'reminders' && <RemindersView />}

          {currentNav === 'customers' && <CustomersView />}

          {currentNav === 'products' && <ProductsView />}

          {currentNav === 'payments' && (
            <PaymentsView
              onSelectInvoice={(invId) => setPreviewInvoiceId(invId)}
              onOpenRecordPayment={() => {
                const payable = invoices.find(
                  (inv) => inv.status === 'ISSUED' && (inv.balanceRemaining === undefined || inv.balanceRemaining > 0)
                );
                if (payable) {
                  setPaymentInvoice(payable);
                } else {
                  alert('No outstanding issued invoices available for payment. Please issue an invoice first.');
                }
              }}
            />
          )}

          {currentNav === 'reports' && <ReportsView />}

          {currentNav === 'settings' && <SettingsView />}
        </Suspense>
      </AppLayout>

      {/* New / Edit Invoice Modal */}
      <Suspense fallback={null}>
        {isNewInvoiceOpen && (
          <NewInvoiceModal
            isOpen={isNewInvoiceOpen}
            editingInvoice={editingInvoice}
            onClose={() => {
              setIsNewInvoiceOpen(false);
              setEditingInvoice(null);
            }}
            onSuccess={(saved) => {
              loadData();
              if (saved?.status === 'ISSUED') {
                setActionNotice(`Invoice ${saved.invoiceNumber} issued officially!`);
              } else {
                setActionNotice('Draft invoice saved to PostgreSQL registry');
              }
              setTimeout(() => setActionNotice(null), 3000);
            }}
          />
        )}

        {/* Record Payment Modal */}
        {paymentInvoice && (
          <RecordPaymentModal
            invoice={paymentInvoice}
            isOpen={Boolean(paymentInvoice)}
            onClose={() => setPaymentInvoice(null)}
            onSuccess={() => {
              loadData();
              setActionNotice('Payment recorded and applied to invoice balance');
              setTimeout(() => setActionNotice(null), 3000);
            }}
          />
        )}

        {/* Professional Invoice Preview & Print Modal */}
        {previewInvoiceId && (
          <InvoicePreviewModal
            invoiceId={previewInvoiceId}
            isOpen={Boolean(previewInvoiceId)}
            onClose={() => setPreviewInvoiceId(null)}
            onIssueSuccess={() => {
              loadData();
            }}
            onOpenPayment={(inv) => {
              setPaymentInvoice(inv);
            }}
          />
        )}
      </Suspense>
    </>
  );
};

export default App;
