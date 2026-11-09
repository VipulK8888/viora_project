import React, { useState, useEffect, useCallback } from 'react';
import { PaymentRecord } from '../../types';
import { fetchPayments } from '../../services/api';
import {
  CreditCard,
  AlertCircle,
  Loader2,
  Calendar,
  IndianRupee,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';

interface PaymentsViewProps {
  onSelectInvoice?: (invoiceId: string) => void;
  onOpenRecordPayment?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  onSelectInvoice,
  onOpenRecordPayment,
}) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [method, setMethod] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPayments({
        page,
        limit,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        method: method !== 'ALL' ? method : undefined,
      });
      setPayments(res.payments);
      setTotalCount(res.totalCount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load payments';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, startDate, endDate, method]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const totalCollectedOnPage = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setMethod('ALL');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || startDate || endDate || method !== 'ALL');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Payment Records</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log of settlements, UPI receipts, and bank transfers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-purple-50 border border-purple-100/80 rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-purple-800 font-semibold uppercase tracking-wider">
                Page Total ({payments.length})
              </div>
              <div className="text-sm font-bold text-purple-950">
                {formatCurrency(totalCollectedOnPage)}
              </div>
            </div>
          </div>

          {onOpenRecordPayment && (
            <button
              onClick={onOpenRecordPayment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoice #, customer name, reference..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Method Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Method:</span>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          >
            <option value="ALL">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Date:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-semibold ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-medium">Loading payments ledger...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-rose-900">Failed to load payments</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-3">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            {hasActiveFilters ? 'No matching payment records found' : 'No payments recorded yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            {hasActiveFilters
              ? 'Try modifying your search query or expanding the date filter range.'
              : 'Payments recorded against issued invoices will appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 font-mono text-[10px] hidden md:table-cell">Request Key</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      {onSelectInvoice ? (
                        <button
                          onClick={() => onSelectInvoice(p.invoiceId)}
                          className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                        >
                          <span>{p.invoiceNumber || 'INV'}</span>
                          <ExternalLink className="w-3 h-3 text-amber-600" />
                        </button>
                      ) : (
                        <span className="font-semibold text-amber-700">{p.invoiceNumber || 'INV'}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {p.customerName || 'Customer'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.paymentDate}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {p.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {p.reference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 hidden md:table-cell truncate max-w-xs">
                      {p.requestKey}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-emerald-700">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} payments
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
