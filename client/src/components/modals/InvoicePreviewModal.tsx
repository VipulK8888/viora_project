import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  SendHorizontal,
  CreditCard,
  FileCheck2,
  Receipt,
  FileText,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { Invoice } from '../../types';
import {
  fetchInvoiceDetails,
  issueInvoice,
  downloadInvoicePdf,
  sendInvoiceWhatsAppReminder,
  sendInvoiceEmailReminder,
} from '../../services/api';
import { InvoiceStatusBadge } from '../invoices/InvoiceStatusBadge';

interface InvoicePreviewModalProps {
  invoiceId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueSuccess?: () => void;
  onOpenPayment?: (inv: Invoice) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoiceId,
  isOpen,
  onClose,
  onIssueSuccess,
  onOpenPayment,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setInvoice(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchInvoiceDetails(invoiceId)
      .then((data) => {
        setInvoice(data);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load invoice details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, invoiceId]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (val: number | undefined) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setIsDownloadingPdf(true);
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
      setActionNotice('PDF downloaded successfully');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error downloading PDF';
      alert(`Error downloading PDF: ${msg}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleIssue = async () => {
    if (!invoice) return;
    if (!window.confirm(`Issue invoice for ${invoice.customerName}? An official sequential invoice number will be assigned.`)) return;

    try {
      setIsIssuing(true);
      const issued = await issueInvoice(invoice.id);
      setInvoice(issued);
      setActionNotice(`Invoice ${issued.invoiceNumber} has been officially issued!`);
      setTimeout(() => setActionNotice(null), 3000);
      onIssueSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to issue invoice';
      alert(`Failed to issue invoice: ${msg}`);
    } finally {
      setIsIssuing(false);
    }
  };

  const [isSendingReminder, setIsSendingReminder] = useState(false);

  const handleSendWhatsAppReminder = async () => {
    if (!invoice) return;
    try {
      setIsSendingReminder(true);
      const res = await sendInvoiceWhatsAppReminder(invoice.id);
      if (res.whatsAppUrl) {
        window.open(res.whatsAppUrl, '_blank');
      }
      setActionNotice('WhatsApp reminder sent & logged');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send WhatsApp reminder';
      alert(`Failed to send WhatsApp reminder: ${msg}`);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleSendEmailReminder = async () => {
    if (!invoice) return;
    try {
      setIsSendingReminder(true);
      const res = await sendInvoiceEmailReminder(invoice.id);
      if (res && res.previewUrl) {
        setActionNotice(`Email dispatched! (Sandbox preview link recorded in Automated Reminders > Logs)`);
      } else {
        setActionNotice(`Email reminder sent to ${invoice.customerEmailSnapshot || 'client'}`);
      }
      setTimeout(() => setActionNotice(null), 4500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send email reminder';
      alert(`Failed to send email reminder: ${msg}`);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const isInterState = invoice?.isInterState ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      {/* Toast Alert */}
      {actionNotice && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 border border-slate-700 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2 no-print">
          <FileCheck2 className="w-4 h-4 text-amber-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Top Action Toolbar (Hidden in print) */}
        <div className="no-print p-4 sm:px-6 bg-slate-50 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider text-amber-600 uppercase">
                Invoice Preview
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {invoice ? invoice.invoiceNumber : 'Loading Invoice...'}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {invoice && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print</span>
                </button>

                {invoice.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={handleIssue}
                    disabled={isIssuing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs transition-colors"
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    <span>{isIssuing ? 'Issuing...' : 'Issue Invoice'}</span>
                  </button>
                )}

                {invoice.status === 'ISSUED' && invoice.paymentStatus !== 'PAID' && (
                  <>
                    <button
                      type="button"
                      onClick={handleSendWhatsAppReminder}
                      disabled={isSendingReminder}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                      title="Send WhatsApp payment reminder"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp Reminder</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendEmailReminder}
                      disabled={isSendingReminder}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
                      title="Send Email payment reminder"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-600" />
                      <span>Email Reminder</span>
                    </button>
                  </>
                )}

                {invoice.status === 'ISSUED' && invoice.paymentStatus !== 'PAID' && onOpenPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPayment(invoice);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-xs transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              aria-label="Close invoice preview modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Viewport */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-100/60 print:bg-white print:p-0">
          {isLoading && (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Loading invoice details...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              {error}
            </div>
          )}

          {invoice && (
            <div className="print-only-container bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
              {/* Top Accent Strip */}
              <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-t -mt-6 sm:-mt-8 -mx-6 sm:-mx-8 mb-6" />

              {/* Header: Company & Invoice Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
                <div className="space-y-1.5 max-w-sm">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/brand-logo.jpg"
                      alt="billv"
                      className="w-8 h-8 rounded-lg object-contain border border-slate-200 shadow-xs flex-shrink-0"
                    />
                    <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {invoice.businessNameSnapshot || 'billv Solutions Pvt Ltd'}
                    </h1>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                    {invoice.businessAddressSnapshot || '108 Brigade Tech Gardens, Outer Ring Road, Bangalore, Karnataka 560048'}
                  </p>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                    <span>Phone: {invoice.businessPhoneSnapshot || '+91 80 4123 4567'}</span>
                    <span>Email: {invoice.businessEmailSnapshot || 'billing@vioratech.com'}</span>
                  </div>
                  {invoice.businessGstinSnapshot && (
                    <div className="text-[11px] font-mono text-slate-700 font-medium">
                      GSTIN: {invoice.businessGstinSnapshot}
                    </div>
                  )}
                  {invoice.businessStateSnapshot && (
                    <div className="text-[11px] text-slate-600 font-medium">
                      State of Origin: {invoice.businessStateSnapshot}
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1 w-full sm:w-auto">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <span className="text-sm font-extrabold tracking-wider text-slate-900 uppercase">
                      TAX INVOICE
                    </span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Invoice Date: </span>
                    <span className="font-medium text-slate-800">{invoice.invoiceDate}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Due Date: </span>
                    <span className="font-medium text-slate-800">{invoice.dueDate}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="text-slate-400">Place of Supply: </span>
                    <span className="font-medium text-slate-800">{invoice.placeOfSupply || 'Karnataka'}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block border border-slate-200 mt-1">
                    {isInterState ? 'Inter-State Supply (IGST)' : 'Intra-State Supply (CGST + SGST)'}
                  </div>
                </div>
              </div>

              {/* Billed To Box */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    BILLED TO (CUSTOMER DETAILS)
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {invoice.customerNameSnapshot || invoice.customerName}
                  </div>
                  <div className="text-xs text-slate-600 max-w-sm whitespace-pre-line">
                    {invoice.customerAddressSnapshot || 'Client Address'}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                    {invoice.customerPhoneSnapshot && <span>Phone: {invoice.customerPhoneSnapshot}</span>}
                    {invoice.customerEmailSnapshot && <span>Email: {invoice.customerEmailSnapshot}</span>}
                  </div>
                </div>

                <div className="sm:text-right space-y-1">
                  {invoice.customerGstinSnapshot && (
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-400">Customer GSTIN: </span>
                      <span className="font-mono font-semibold">{invoice.customerGstinSnapshot}</span>
                    </div>
                  )}
                  {invoice.customerStateSnapshot && (
                    <div className="text-xs text-slate-700">
                      <span className="text-slate-400">Customer State: </span>
                      <span className="font-medium">{invoice.customerStateSnapshot}</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <span className="text-xs text-slate-400 mr-2">Payment Status:</span>
                    <InvoiceStatusBadge paymentStatus={invoice.paymentStatus} />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 font-semibold text-slate-700">
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Item & Description</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Disc</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">{isInterState ? 'IGST' : 'CGST+SGST'}</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {it.descriptionSnapshot}
                            {it.unit && (
                              <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                                ({it.unit})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">{it.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {it.discountAmount ? `-${formatCurrency(it.discountAmount)}` : '₹0.00'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">
                            {formatCurrency(it.taxableAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <div>{formatCurrency(it.taxAmount)}</div>
                            <div className="text-[10px] text-slate-400 font-sans">({it.taxRate}%)</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(it.lineTotal)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          No line items found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary and Tax Breakdown Section */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2 page-break-avoid">
                {/* Notes and Terms */}
                <div className="w-full sm:w-1/2 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Notes & Terms
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/70 whitespace-pre-line leading-relaxed">
                    {invoice.notes || 'Payment due within the agreed credit cycle. Bank and electronic transfers accepted.'}
                  </p>
                </div>

                {/* Right Totals Card */}
                <div className="w-full sm:w-72 bg-slate-50 rounded-xl p-4 border border-slate-200/90 space-y-2 text-xs">
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountTotal > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Total Discounts:</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        -{formatCurrency(invoice.discountTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5 text-slate-700 font-medium">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">{formatCurrency(invoice.taxableAmount)}</span>
                  </div>

                  {/* GST Split */}
                  <div className="py-1 border-t border-slate-200 space-y-1">
                    {isInterState ? (
                      <div className="flex justify-between text-slate-600">
                        <span>IGST (Integrated Tax):</span>
                        <span className="font-mono">{formatCurrency(invoice.igstTotal)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-600">
                          <span>CGST (Central Tax):</span>
                          <span className="font-mono">{formatCurrency(invoice.cgstTotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>SGST (State Tax):</span>
                          <span className="font-mono">{formatCurrency(invoice.sgstTotal)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-slate-700 font-semibold pt-0.5">
                      <span>Total GST Tax:</span>
                      <span className="font-mono">{formatCurrency(invoice.taxTotal)}</span>
                    </div>
                  </div>

                  {/* Grand Total Highlight */}
                  <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm font-extrabold text-slate-950">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base font-extrabold text-slate-950">
                      {formatCurrency(invoice.grandTotal)}
                    </span>
                  </div>

                  {/* Paid / Outstanding info */}
                  {invoice.status === 'ISSUED' && (
                    <div className="pt-2 border-t border-slate-200/70 text-[11px] space-y-1">
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Total Paid:</span>
                        <span className="font-mono">{formatCurrency(invoice.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between text-amber-800 font-bold">
                        <span>Outstanding Balance:</span>
                        <span className="font-mono">{formatCurrency(invoice.balanceRemaining)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Records Section (if any payments) */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-2 page-break-avoid">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Payment History Ledger
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Payment Method</th>
                          <th className="py-2 px-3">Reference / Notes</th>
                          <th className="py-2 px-3 text-right">Amount Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {invoice.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3">{p.paymentDate}</td>
                            <td className="py-2 px-3 font-semibold">{p.method}</td>
                            <td className="py-2 px-3 text-slate-500">{p.reference || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              {formatCurrency(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Computer-Generated Notice */}
              <div className="pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
                Thank you for your business. This is a computer-generated tax invoice generated via Viora Bills.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
