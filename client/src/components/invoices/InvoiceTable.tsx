import React, { useState, useMemo } from 'react';
import { Invoice, Customer } from '../../types';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { EmptyState } from './EmptyState';
import {
  Search,
  Filter,
  Eye,
  FilePlus,
  CreditCard,
  SendHorizontal,
  Download,
  FileEdit,
  BellRing,
  Trash2,
  Ban,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  User,
} from 'lucide-react';
import { downloadInvoicePdf } from '../../services/api';

export interface InvoiceTableProps {
  invoices: Invoice[];
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  pageSize?: number;
  customers?: Customer[];
  selectedCustomerId?: string;
  onCustomerChange?: (custId: string) => void;
  startDate?: string;
  endDate?: string;
  onDateRangeChange?: (start?: string, end?: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectInvoice?: (invoice: Invoice) => void;
  onNewInvoice?: () => void;
  onIssueInvoice?: (invoice: Invoice) => void;
  onRecordPayment?: (invoice: Invoice) => void;
  onEditDraft?: (invoice: Invoice) => void;
  onDeleteDraft?: (invoice: Invoice) => void;
  onCancelInvoice?: (invoice: Invoice) => void;
  // Legacy compatibility props (ignored or removed)
  isSimulatedEmpty?: boolean;
  onSimulateEmptyToggle?: (val: boolean) => void;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  totalCount: externalTotalCount,
  currentPage: externalPage,
  totalPages: externalTotalPages,
  onPageChange,
  pageSize = 20,
  customers = [],
  selectedCustomerId,
  onCustomerChange,
  startDate,
  endDate,
  onDateRangeChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  searchQuery: externalSearchQuery,
  onSearchChange,
  isLoading = false,
  error = null,
  onRetry,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onDeleteDraft,
  onCancelInvoice,
}) => {
  // Local state fallbacks if external control is not provided (e.g. on DashboardView)
  const [internalSearch, setInternalSearch] = useState('');
  const [internalStatus, setInternalStatus] = useState<string>('ALL');
  const [internalCustomer, setInternalCustomer] = useState<string>('ALL');
  const [internalStart, setInternalStart] = useState<string>('');
  const [internalEnd, setInternalEnd] = useState<string>('');
  const [internalPage, setInternalPage] = useState(1);

  const isServerControlled = Boolean(onPageChange);

  const activeSearch = isServerControlled ? externalSearchQuery || '' : internalSearch;
  const activeStatus = isServerControlled ? externalStatusFilter || 'ALL' : internalStatus;
  const activeCustomer = isServerControlled ? selectedCustomerId || 'ALL' : internalCustomer;
  const activeStart = isServerControlled ? startDate || '' : internalStart;
  const activeEnd = isServerControlled ? endDate || '' : internalEnd;
  const activePage = isServerControlled ? externalPage || 1 : internalPage;

  // Filter local invoices if not server-controlled
  const displayedInvoices = useMemo(() => {
    if (isServerControlled) return invoices;

    return invoices.filter((inv) => {
      let matchesStatus = true;
      if (activeStatus === 'DRAFT') matchesStatus = inv.status === 'DRAFT';
      else if (activeStatus === 'ISSUED') matchesStatus = inv.status === 'ISSUED';
      else if (activeStatus === 'CANCELLED') matchesStatus = inv.status === 'CANCELLED';
      else if (activeStatus === 'PAID') matchesStatus = inv.paymentStatus === 'PAID';
      else if (activeStatus === 'UNPAID') matchesStatus = inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIALLY_PAID';

      let matchesCustomer = true;
      if (activeCustomer !== 'ALL') {
        matchesCustomer = inv.customerId === activeCustomer;
      }

      let matchesSearch = true;
      const q = activeSearch.toLowerCase().trim();
      if (q) {
        const customer = (inv.customerName || '').toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        matchesSearch = num.includes(q) || customer.includes(q);
      }

      return matchesStatus && matchesCustomer && matchesSearch;
    });
  }, [invoices, isServerControlled, activeStatus, activeCustomer, activeSearch]);

  const totalCount = isServerControlled ? externalTotalCount ?? displayedInvoices.length : displayedInvoices.length;
  const totalPages = isServerControlled ? externalTotalPages ?? Math.max(1, Math.ceil(totalCount / pageSize)) : Math.max(1, Math.ceil(displayedInvoices.length / pageSize));

  // Slice local page if not server-controlled
  const pagedInvoices = useMemo(() => {
    if (isServerControlled) return invoices;
    const start = (activePage - 1) * pageSize;
    return displayedInvoices.slice(start, start + pageSize);
  }, [invoices, isServerControlled, displayedInvoices, activePage, pageSize]);

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    else setInternalSearch(val);
    if (!isServerControlled) setInternalPage(1);
  };

  const handleStatusChange = (val: string) => {
    if (onStatusFilterChange) onStatusFilterChange(val);
    else setInternalStatus(val);
    if (!isServerControlled) setInternalPage(1);
  };

  const handleCustomerSelect = (val: string) => {
    if (onCustomerChange) onCustomerChange(val);
    else setInternalCustomer(val);
    if (!isServerControlled) setInternalPage(1);
  };

  const handleDateChange = (start?: string, end?: string) => {
    if (onDateRangeChange) onDateRangeChange(start, end);
    else {
      setInternalStart(start || '');
      setInternalEnd(end || '');
      setInternalPage(1);
    }
  };

  const handlePageSelect = (page: number) => {
    if (onPageChange) onPageChange(page);
    else setInternalPage(page);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Invoices & Receivables</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </span>
            {isLoading && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage drafts, issued invoices, tax breakdowns, and payment statuses
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNewInvoice && (
            <button
              onClick={onNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-xs transition-colors"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="p-3.5 bg-slate-50/60 border-b border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={activeSearch}
              aria-label="Search by invoice number or customer name"
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by Invoice number or customer name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Customer Dropdown Filter */}
          {customers.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={activeCustomer}
                aria-label="Filter by customer"
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="py-1 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="ALL">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={activeStart}
              aria-label="Filter invoices from date"
              onChange={(e) => handleDateChange(e.target.value, activeEnd)}
              className="py-1 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              title="From date"
            />
            <span className="text-slate-600">to</span>
            <input
              type="date"
              value={activeEnd}
              aria-label="Filter invoices to date"
              onChange={(e) => handleDateChange(activeStart, e.target.value)}
              className="py-1 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              title="To date"
            />
            {(activeStart || activeEnd) && (
              <button
                type="button"
                onClick={() => handleDateChange('', '')}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 pt-1">
          <span className="text-xs text-slate-600 flex items-center gap-1 mr-1.5">
            <Filter className="w-3 h-3" />
            Status:
          </span>
          {(['ALL', 'ISSUED', 'DRAFT', 'PAID', 'UNPAID', 'CANCELLED'] as const).map((filter) => {
            const isActive = activeStatus === filter;
            const label =
              filter === 'ALL'
                ? 'All'
                : filter === 'PAID'
                ? 'Paid'
                : filter === 'UNPAID'
                ? 'Unpaid / Partial'
                : filter.charAt(0) + filter.slice(1).toLowerCase();
            return (
              <button
                key={filter}
                type="button"
                onClick={() => handleStatusChange(filter)}
                className={`px-2.5 py-1 rounded-md text-xs transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="p-6 bg-red-50/70 border-b border-red-200 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Backend Connection Error</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md">{error}</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          )}
        </div>
      )}

      {/* Table content or empty state */}
      {!error && pagedInvoices.length === 0 ? (
        <EmptyState
          onNewInvoice={onNewInvoice}
          onResetFilters={() => {
            handleSearchChange('');
            handleStatusChange('ALL');
            handleCustomerSelect('ALL');
            handleDateChange('', '');
          }}
          isFiltered={
            activeSearch !== '' ||
            activeStatus !== 'ALL' ||
            activeCustomer !== 'ALL' ||
            Boolean(activeStart || activeEnd)
          }
        />
      ) : !error ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 hidden sm:table-cell">Date</th>
                <th className="py-3 px-4 hidden md:table-cell">Due Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {pagedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectInvoice?.(inv)}
                >
                  {/* Invoice Number */}
                  <td className="py-3.5 px-4 sm:px-6 font-semibold text-amber-700 group-hover:underline">
                    {inv.invoiceNumber}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{inv.customerName || 'Customer'}</div>
                    {inv.customerEmail && (
                      <div className="text-[11px] text-slate-600 truncate max-w-[180px]">
                        {inv.customerEmail}
                      </div>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-slate-500 hidden sm:table-cell">
                    {inv.invoiceDate}
                  </td>

                  {/* Due Date */}
                  <td className="py-3.5 px-4 text-slate-500 hidden md:table-cell">
                    {inv.dueDate}
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatAmount(inv.grandTotal)}
                  </td>

                  {/* Lifecycle Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>

                  {/* Payment Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    {inv.status === 'ISSUED' ? (
                      <InvoiceStatusBadge paymentStatus={inv.paymentStatus} />
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 sm:px-6 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectInvoice?.(inv)}
                        title="Preview & Print"
                        aria-label={`Preview invoice ${inv.invoiceNumber}`}
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await downloadInvoicePdf(inv.id, inv.invoiceNumber);
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : 'Download error';
                            alert(`Download error: ${msg}`);
                          }
                        }}
                        title="Download A4 PDF"
                        aria-label={`Download PDF for invoice ${inv.invoiceNumber}`}
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Edit Draft */}
                      {inv.status === 'DRAFT' && onEditDraft && (
                        <button
                          type="button"
                          onClick={() => onEditDraft(inv)}
                          title="Edit Draft"
                          aria-label={`Edit draft invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete Draft */}
                      {inv.status === 'DRAFT' && onDeleteDraft && (
                        <button
                          type="button"
                          onClick={() => onDeleteDraft(inv)}
                          title="Delete Draft"
                          aria-label={`Delete draft invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Issue Draft */}
                      {inv.status === 'DRAFT' && onIssueInvoice && (
                        <button
                          type="button"
                          onClick={() => onIssueInvoice(inv)}
                          title="Issue Official Invoice"
                          aria-label={`Issue official invoice ${inv.invoiceNumber}`}
                          className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md flex items-center gap-1"
                        >
                          <SendHorizontal className="w-3 h-3" />
                          Issue
                        </button>
                      )}

                      {/* Remind Button */}
                      {inv.status === 'ISSUED' && inv.paymentStatus !== 'PAID' && (
                        <button
                          type="button"
                          onClick={() => onSelectInvoice?.(inv)}
                          title="Remind (WhatsApp & Email)"
                          aria-label={`Send automated reminder for invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                        >
                          <BellRing className="w-4 h-4" />
                        </button>
                      )}

                      {/* Record Payment */}
                      {inv.status === 'ISSUED' && inv.paymentStatus !== 'PAID' && onRecordPayment && (
                        <button
                          type="button"
                          onClick={() => onRecordPayment(inv)}
                          title="Record Payment"
                          aria-label={`Record payment for invoice ${inv.invoiceNumber}`}
                          className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-1"
                        >
                          <CreditCard className="w-3 h-3" />
                          Pay
                        </button>
                      )}

                      {/* Cancel Invoice (Issued with no payments) */}
                      {inv.status === 'ISSUED' && inv.paymentStatus === 'UNPAID' && onCancelInvoice && (
                        <button
                          type="button"
                          onClick={() => onCancelInvoice(inv)}
                          title="Cancel Invoice"
                          aria-label={`Cancel invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Pagination Footer */}
      {!error && totalCount > 0 && (
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{Math.min(1 + (activePage - 1) * pageSize, totalCount)}</span> to{' '}
            <span className="font-semibold text-slate-900">{Math.min(activePage * pageSize, totalCount)}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalCount}</span> invoices
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Page <span className="font-semibold text-slate-900">{activePage}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageSelect(Math.max(1, activePage - 1))}
                disabled={activePage <= 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handlePageSelect(Math.min(totalPages, activePage + 1))}
                disabled={activePage >= totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
