import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, Customer } from '../../types';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { FileText, CheckCircle2, Clock, FileEdit, FileCheck2 } from 'lucide-react';
import {
  fetchInvoices,
  fetchCustomers,
  deleteDraftInvoice,
  cancelInvoice,
} from '../../services/api';

interface InvoicesViewProps {
  invoices?: Invoice[]; // Optional fallback
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  onIssueInvoice: (inv: Invoice) => void;
  onRecordPayment: (inv: Invoice) => void;
  onEditDraft?: (inv: Invoice) => void;
  onInvoiceDataChanged?: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onInvoiceDataChanged,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerId, setCustomerId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load customer list for filter dropdown
  useEffect(() => {
    fetchCustomers({ limit: 100 })
      .then((res) => setCustomers(res.customers))
      .catch((err) => console.error('Failed to load customers for invoice filter', err));
  }, []);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Map UI status filter to backend status and paymentStatus
      let apiStatus = 'ALL';
      let apiPaymentStatus = 'ALL';

      if (statusFilter === 'DRAFT') {
        apiStatus = 'DRAFT';
      } else if (statusFilter === 'ISSUED') {
        apiStatus = 'ISSUED';
      } else if (statusFilter === 'CANCELLED') {
        apiStatus = 'CANCELLED';
      } else if (statusFilter === 'PAID') {
        apiStatus = 'ISSUED';
        apiPaymentStatus = 'PAID';
      } else if (statusFilter === 'UNPAID') {
        apiStatus = 'ISSUED';
        apiPaymentStatus = 'UNPAID';
      }

      const res = await fetchInvoices({
        page,
        limit,
        status: apiStatus !== 'ALL' ? apiStatus : undefined,
        paymentStatus: apiPaymentStatus !== 'ALL' ? apiPaymentStatus : undefined,
        customerId: customerId !== 'ALL' ? customerId : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchQuery.trim() || undefined,
      });

      if (!res.isBackendConnected) {
        setError('Cannot connect to billing backend service. Please check database and server status.');
        return;
      }

      setInvoices(res.invoices);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, customerId, startDate, endDate, searchQuery]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDeleteDraft = async (inv: Invoice) => {
    if (!window.confirm(`Are you sure you want to delete draft invoice ${inv.invoiceNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDraftInvoice(inv.id);
      setToastMessage(`Draft invoice ${inv.invoiceNumber} deleted successfully.`);
      setTimeout(() => setToastMessage(null), 3000);
      loadInvoices();
      onInvoiceDataChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete error';
      alert(`Delete error: ${msg}`);
    }
  };

  const handleCancelInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Are you sure you want to cancel issued invoice ${inv.invoiceNumber}? This will mark it as cancelled.`)) {
      return;
    }

    try {
      await cancelInvoice(inv.id);
      setToastMessage(`Invoice ${inv.invoiceNumber} has been cancelled.`);
      setTimeout(() => setToastMessage(null), 3000);
      loadInvoices();
      onInvoiceDataChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancellation error';
      alert(`Cancellation error: ${msg}`);
    }
  };

  const issuedCount = invoices.filter((i) => i.status === 'ISSUED').length;
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const paidCount = invoices.filter((i) => i.paymentStatus === 'PAID').length;
  const pendingCount = invoices.filter(
    (i) => i.status === 'ISSUED' && (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID')
  ).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2 no-print">
          <FileCheck2 className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Issued Invoices</div>
            <div className="text-base font-bold text-slate-900">{issuedCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Draft Invoices</div>
            <div className="text-base font-bold text-slate-900">{draftCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Settled (Paid)</div>
            <div className="text-base font-bold text-emerald-700">{paidCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Awaiting Payment</div>
            <div className="text-base font-bold text-amber-700">{pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table with Server-Side Pagination & Controls */}
      <InvoiceTable
        invoices={invoices}
        totalCount={totalCount}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        pageSize={limit}
        customers={customers}
        selectedCustomerId={customerId}
        onCustomerChange={(newCustId) => {
          setCustomerId(newCustId);
          setPage(1);
        }}
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={(start, end) => {
          setStartDate(start || '');
          setEndDate(end || '');
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(newStatus) => {
          setStatusFilter(newStatus);
          setPage(1);
        }}
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query);
          setPage(1);
        }}
        isLoading={isLoading}
        error={error}
        onRetry={loadInvoices}
        onSelectInvoice={onSelectInvoice}
        onNewInvoice={onNewInvoice}
        onIssueInvoice={async (inv) => {
          await onIssueInvoice(inv);
          loadInvoices();
        }}
        onRecordPayment={(inv) => onRecordPayment(inv)}
        onEditDraft={onEditDraft}
        onDeleteDraft={handleDeleteDraft}
        onCancelInvoice={handleCancelInvoice}
      />
    </div>
  );
};
