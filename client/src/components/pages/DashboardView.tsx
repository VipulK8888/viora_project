import React from 'react';
import { MetricsGrid } from '../dashboard/MetricsGrid';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { Invoice, DashboardSummary } from '../../types';
import {
  FilePlus,
  Users,
  Package,
  BellRing,
} from 'lucide-react';

interface DashboardViewProps {
  summary?: DashboardSummary | null;
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  isSimulatedEmpty?: boolean;
  onSimulateEmptyToggle?: (val: boolean) => void;
  onNavigateToCustomers?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToReminders?: () => void;
  onDateRangeChange?: (startDate?: string, endDate?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onNavigateToCustomers,
  onNavigateToProducts,
  onNavigateToReminders,
  onDateRangeChange,
}) => {
  const [selectedPreset, setSelectedPreset] = React.useState<'ALL' | 'TODAY' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const monthStartStr = todayStr.slice(0, 7) + '-01';

  const handlePresetSelect = (preset: 'ALL' | 'TODAY' | 'MONTH' | 'CUSTOM') => {
    setSelectedPreset(preset);
    if (preset === 'ALL') {
      onDateRangeChange?.(undefined, undefined);
    } else if (preset === 'TODAY') {
      onDateRangeChange?.(todayStr, todayStr);
    } else if (preset === 'MONTH') {
      onDateRangeChange?.(monthStartStr, todayStr);
    }
  };

  const handleApplyCustomDates = () => {
    if (customStart || customEnd) {
      onDateRangeChange?.(customStart || undefined, customEnd || undefined);
    }
  };

  const hasNoInvoices = invoices.length === 0;

  return (
    <div className="space-y-6">
      {/* Top Toolbar Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Reporting Window Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Reporting Window:</span>
          <div className="inline-flex rounded-lg bg-slate-100/90 p-0.5 border border-slate-200/50">
            {(['ALL', 'TODAY', 'MONTH', 'CUSTOM'] as const).map((preset) => {
              const isActive = selectedPreset === preset;
              const labels = {
                ALL: 'All Time',
                TODAY: 'Today',
                MONTH: 'This Month',
                CUSTOM: 'Custom',
              };
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-1 rounded-md text-xs transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {selectedPreset === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 text-xs"
              />
              <button
                onClick={handleApplyCustomDates}
                className="px-2.5 py-0.5 font-semibold text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Create Invoice Primary Button */}
        <div>
          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors"
          >
            <FilePlus className="w-4 h-4 text-slate-950" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* No Invoices Banner (Hero banner from image) */}
      {hasNoInvoices && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            No invoices found for this reporting period
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Create and issue your first invoice to populate real-time sales and payment analytics.
          </p>
          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs transition-colors"
          >
            <span className="font-extrabold">+</span> Create New Invoice
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <section aria-label="Financial Overview">
        <MetricsGrid summary={summary} />
      </section>

      {/* Quick Link Entity Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Directory */}
        <button
          type="button"
          onClick={onNavigateToCustomers}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer flex items-center justify-between text-left w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Active Customer Directory</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {summary?.counts.customers ?? 0} registered client accounts
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            Manage →
          </span>
        </button>

        {/* Products & Services Catalog */}
        <button
          type="button"
          onClick={onNavigateToProducts}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer flex items-center justify-between text-left w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 flex-shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Products & Services Catalog</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {summary?.counts.products ?? 0} billing catalog items
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            Manage →
          </span>
        </button>

        {/* Automated Reminders */}
        <button
          type="button"
          onClick={onNavigateToReminders}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-amber-300 transition-colors cursor-pointer flex items-center justify-between text-left w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 flex-shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Automated Reminders</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                WhatsApp & Email Cadence
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            Open →
          </span>
        </button>
      </section>

      {/* Invoices & Receivables Table */}
      <section aria-label="Recent Invoices">
        <InvoiceTable
          invoices={invoices}
          onSelectInvoice={onSelectInvoice}
          onNewInvoice={onNewInvoice}
        />
      </section>
    </div>
  );
};
