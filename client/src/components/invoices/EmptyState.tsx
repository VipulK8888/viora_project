import React from 'react';
import { FilePlus2, ReceiptText, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  onNewInvoice?: () => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNewInvoice,
  onResetFilters,
  isFiltered = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
          <ReceiptText className="w-7 h-7" />
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-900 mb-1">
        {isFiltered ? 'No matching invoices found' : 'No invoices created yet'}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mb-5">
        {isFiltered
          ? 'No invoices match your current search query or status filter. Try clearing your filters.'
          : 'Get started by creating your first professional GST-ready invoice. Track payments and billing effortlessly.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {isFiltered && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
        <button
          onClick={onNewInvoice}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs transition-colors"
        >
          <FilePlus2 className="w-4 h-4" />
          Create First Invoice
        </button>
      </div>
    </div>
  );
};
