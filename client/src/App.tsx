import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/pages/DashboardView';
import { InvoicesView } from './components/pages/InvoicesView';
import { CustomersView } from './components/pages/CustomersView';
import { ProductsView } from './components/pages/ProductsView';
import { PaymentsView } from './components/pages/PaymentsView';
import { ReportsView } from './components/pages/ReportsView';
import { SettingsView } from './components/pages/SettingsView';
import { RemindersView } from './components/pages/RemindersView';
import { NewInvoiceModal } from './components/modals/NewInvoiceModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { InvoicePreviewModal } from './components/modals/InvoicePreviewModal';
import {
  NavigationKey,
  Invoice,
  DashboardSummary,
  SystemHealth,
} from './types';
import {
  fetchHealth,
  fetchInvoices,
  fetchDashboardSummary,
  issueInvoice,
} from './services/api';
import {
  FileCheck2,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavigationKey>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 'checking' });
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [health, invData, summary] = await Promise.all([
      fetchHealth(),
      fetchInvoices(),
      fetchDashboardSummary(),
    ]);

    setSystemHealth(health);
    setInvoices(invData.invoices);
    setDashboardSummary(summary);
  }, []);

  useEffect(() => {
    loadData();

    // Health poll every 20s
    const timer = setInterval(async () => {
      const health = await fetchHealth();
      setSystemHealth(health);
    }, 20000);

    return () => clearInterval(timer);
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
      const summary = await fetchDashboardSummary({ startDate, endDate });
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
        {currentNav === 'dashboard' && (
          <DashboardView
            summary={dashboardSummary}
            invoices={invoices}
            onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
            onNewInvoice={handleOpenNewInvoice}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
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
      </AppLayout>

      {/* New / Edit Invoice Modal */}
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

      {/* Record Payment Modal */}
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

      {/* Professional Invoice Preview & Print Modal */}
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
    </>
  );
};

export default App;
