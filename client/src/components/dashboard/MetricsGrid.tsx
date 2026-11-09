import React from 'react';
import { StatCard } from './StatCard';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { DashboardSummary } from '../../types';

interface MetricsGridProps {
  summary?: DashboardSummary | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const totalSalesVal = summary ? summary.metrics.totalSales.amount : 0;
  const invoiceCountVal = summary ? summary.metrics.totalInvoices.count : 0;
  const collectedVal = summary ? summary.metrics.amountCollected.amount : 0;
  const outstandingVal = summary ? summary.metrics.outstandingBalance.amount : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. TOTAL SALES */}
      <StatCard
        title="TOTAL SALES"
        value={formatCurrency(totalSalesVal)}
        customIcon={<span className="text-sm font-bold">₹</span>}
      />

      {/* 2. TOTAL INVOICES */}
      <StatCard
        title="TOTAL INVOICES"
        value={String(invoiceCountVal)}
        icon={FileText}
      />

      {/* 3. AMOUNT COLLECTED */}
      <StatCard
        title="AMOUNT COLLECTED"
        value={formatCurrency(collectedVal)}
        icon={CheckCircle2}
      />

      {/* 4. OUTSTANDING RECEIVABLES */}
      <StatCard
        title="OUTSTANDING RECEIVABLES"
        value={formatCurrency(outstandingVal)}
        icon={AlertCircle}
      />
    </div>
  );
};
