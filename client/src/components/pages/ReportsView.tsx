import React, { useState, useEffect, useCallback } from 'react';
import { fetchSalesReport } from '../../services/api';
import {
  IndianRupee,
  Receipt,
  CreditCard,
  Filter,
  Loader2,
  AlertCircle,
  Percent,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSalesReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        groupBy,
      });
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales report');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, groupBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt || 0);
  };

  const summary = reportData?.summary;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Sales & Revenue Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated revenue metrics and collection settlements
          </p>
        </div>

        {/* Aggregation Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
          <button
            onClick={() => setGroupBy('day')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              groupBy === 'day'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily View
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              groupBy === 'month'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly View
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          Filter Period:
        </span>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-semibold ml-auto"
          >
            Clear Date Filters
          </button>
        )}
      </div>

      {/* Loading & Error States */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-medium">Computing sales & collections aggregates...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-rose-900">Failed to generate report</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Issued Sales
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">
                {formatCurrency(summary?.totalSales)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {summary?.totalIssuedInvoices} issued invoices
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Collections Received
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-2">
                {formatCurrency(summary?.totalCollected)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {summary?.totalPayments} settlements recorded
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Net Outstanding
                </span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-amber-700 mt-2">
                {formatCurrency(summary?.netOutstanding)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Active receivables pending collection
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Output Tax (GST)
                </span>
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-900 mt-2">
                {formatCurrency(summary?.totalTax)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Total statutory tax liability
              </div>
            </div>
          </div>

          {/* Visual Sales vs Collections Timeline Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Revenue Comparison Timeline ({groupBy === 'day' ? 'Daily' : 'Monthly'})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visual contrast between invoiced receivables and payment collections
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block" />
                  <span className="text-slate-600">Issued Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-violet-600 inline-block" />
                  <span className="text-slate-600">Payments Collected</span>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            {(() => {
              const salesMap = new Map((reportData?.salesTimeline || []).map((s: any) => [s.period, s.grandTotal]));
              const collectionsMap = new Map((reportData?.collectionsTimeline || []).map((c: any) => [c.period, c.totalCollected]));

              const allPeriods = Array.from(
                new Set([
                  ...(reportData?.salesTimeline || []).map((s: any) => s.period),
                  ...(reportData?.collectionsTimeline || []).map((c: any) => c.period),
                ])
              ).sort();

              const chartData = allPeriods.map((period) => ({
                period,
                sales: Number(salesMap.get(period) || 0),
                collections: Number(collectionsMap.get(period) || 0),
              }));

              const maxVal = Math.max(...chartData.map((d) => Math.max(d.sales, d.collections)), 1000);

              if (chartData.length === 0) {
                return (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No sales or collections activity recorded for the selected date range.
                  </div>
                );
              }

              return (
                <div className="pt-6 pb-2 overflow-x-auto">
                  <div className="min-w-[480px]">
                    <div className="h-48 flex items-end gap-3 sm:gap-6 border-b border-slate-200 pb-2 px-2">
                      {chartData.map((item) => {
                        const salesHeight = Math.max(4, Math.round((item.sales / maxVal) * 160));
                        const collHeight = Math.max(4, Math.round((item.collections / maxVal) * 160));

                        return (
                          <div key={item.period} className="flex-1 flex flex-col items-center gap-1 group relative">
                            {/* Bar Pair */}
                            <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-40">
                              {/* Sales Bar */}
                              <div
                                style={{ height: `${salesHeight}px` }}
                                className="w-3 sm:w-5 bg-amber-400 rounded-t hover:bg-amber-500 transition-all cursor-pointer relative"
                              >
                                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow whitespace-nowrap">
                                  Sales: {formatCurrency(item.sales)}
                                </div>
                              </div>

                              {/* Collections Bar */}
                              <div
                                style={{ height: `${collHeight}px` }}
                                className="w-3 sm:w-5 bg-violet-600 rounded-t hover:bg-violet-700 transition-all cursor-pointer relative"
                              >
                                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow whitespace-nowrap">
                                  Collected: {formatCurrency(item.collections)}
                                </div>
                              </div>
                            </div>

                            {/* X-axis Label */}
                            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[60px] sm:max-w-none">
                              {item.period}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Detailed Timelines: Sales vs Collections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Invoice Date */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Sales Timeline</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {reportData?.salesTimeline?.length || 0} periods
                </span>
              </div>

              {reportData?.salesTimeline?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No sales recorded for this timeframe
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Period</th>
                        <th className="py-2.5 px-3 text-center">Invoices</th>
                        <th className="py-2.5 px-3 text-right">Tax (GST)</th>
                        <th className="py-2.5 px-4 text-right">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData?.salesTimeline?.map((item: any) => (
                        <tr key={item.period} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                            {item.period}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">
                            {item.invoiceCount}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            {formatCurrency(item.taxTotal)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(item.grandTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Collections by Payment Date */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Collections Timeline</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {reportData?.collectionsTimeline?.length || 0} periods
                </span>
              </div>

              {reportData?.collectionsTimeline?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No payment settlements recorded for this timeframe
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-4">Period</th>
                        <th className="py-2.5 px-3 text-center">Payments</th>
                        <th className="py-2.5 px-4 text-right">Total Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData?.collectionsTimeline?.map((item: any) => (
                        <tr key={item.period} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                            {item.period}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">
                            {item.paymentCount}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {formatCurrency(item.totalCollected)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
