import React from 'react';
import { InvoiceLifecycleStatus, PaymentStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, FileEdit, CheckCheck } from 'lucide-react';

interface Props {
  status?: InvoiceLifecycleStatus | string;
  paymentStatus?: PaymentStatus | string;
}

export const InvoiceStatusBadge: React.FC<Props> = ({ status, paymentStatus }) => {
  // If paymentStatus is provided, render payment status badge
  if (paymentStatus) {
    switch (paymentStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCheck className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <Clock className="w-3.5 h-3.5" />
            Partial
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Unpaid
          </span>
        );
    }
  }

  // Otherwise render lifecycle status
  switch (status) {
    case 'ISSUED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Issued
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    case 'DRAFT':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <FileEdit className="w-3.5 h-3.5" />
          Draft
        </span>
      );
  }
};
