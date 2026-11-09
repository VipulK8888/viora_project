import React, { useState, useEffect } from 'react';
import { X, CreditCard, IndianRupee, Hash, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { Invoice } from '../../types';
import { recordInvoicePayment } from '../../services/api';

interface RecordPaymentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !invoice) return null;

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [amount, setAmount] = useState(String(invoice.balanceRemaining || ''));
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const payAmt = Number(amount) || 0;
  const projectedBalance = Math.max(0, invoice.balanceRemaining - payAmt);
  const isOverpaying = payAmt > invoice.balanceRemaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Number.isNaN(payAmt) || payAmt <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    if (isOverpaying) {
      setError(`Payment amount cannot exceed outstanding balance (${formatCurrency(invoice.balanceRemaining)})`);
      return;
    }

    if (!paymentDate) {
      setError('Payment date is required');
      return;
    }

    if (!confirmed) {
      setError('Please check the confirmation box before recording the payment');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const requestKey = `PAY-${invoice.id.slice(-6)}-${Date.now()}`;
      await recordInvoicePayment(invoice.id, {
        amount: payAmt,
        paymentDate,
        method,
        reference: reference.trim() || undefined,
        requestKey,
      });

      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment recording failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Record Payment</h3>
              <p className="text-[11px] text-slate-500 font-mono">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invoice Summary Pill */}
        <div className="mx-6 mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Customer:</span>
            <span className="font-semibold text-navy-900">{invoice.customerName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Invoiced:</span>
            <span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Already Paid:</span>
            <span className="text-emerald-700">{formatCurrency(invoice.totalPaid)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Current Outstanding:</span>
            <span className="text-amber-600">{formatCurrency(invoice.balanceRemaining)}</span>
          </div>
          {payAmt > 0 && !isOverpaying && (
            <div className="flex justify-between font-semibold text-violet-700 pt-1 border-t border-dashed border-violet-200">
              <span>Remaining After Payment:</span>
              <span className="font-bold">{formatCurrency(projectedBalance)}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="payment-amount-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="payment-amount-input"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={invoice.balanceRemaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="payment-date-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="payment-date-input"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="payment-method-select" className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              id="payment-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="CHEQUE">Cheque / Demand Draft</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="payment-reference-input" className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Transaction ID / UTR Number
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="payment-reference-input"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. AXIS992148201 / UPI12345"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all font-mono"
              />
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                id="payment-confirm-checkbox"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-amber-500 focus:ring-amber-400/20 border-slate-300"
              />
              <span className="text-[11px] text-slate-600 leading-tight">
                I confirm that payment of <strong className="text-slate-900">{formatCurrency(payAmt)}</strong> was physically received from <strong className="text-slate-900">{invoice.customerName}</strong> via {method.replace('_', ' ')}.
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || invoice.balanceRemaining <= 0 || !confirmed || isOverpaying || payAmt <= 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
