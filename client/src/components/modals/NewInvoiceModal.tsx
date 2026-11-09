import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FilePlus,
  Trash2,
  Plus,
  SendHorizontal,
  FileText,
  User,
} from 'lucide-react';
import { Customer, Product, Invoice } from '../../types';
import {
  fetchCustomers,
  fetchProducts,
  createInvoice,
  updateDraftInvoice,
  issueInvoice,
  fetchInvoiceDetails,
} from '../../services/api';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (issuedInvoice?: Invoice) => void;
  editingInvoice?: Invoice | null;
}

interface ItemRow {
  productId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
}

const COMMON_UNITS = ['PCS', 'HRS', 'NOS', 'BOX', 'SET', 'MONTH', 'KG', 'MTR'];
const GST_RATES = [0, 5, 12, 18, 28];
const INDIAN_STATES = [
  'Karnataka',
  'Maharashtra',
  'Delhi',
  'Tamil Nadu',
  'Telangana',
  'Gujarat',
  'Uttar Pradesh',
  'West Bengal',
  'Rajasthan',
  'Kerala',
  'Haryana',
  'Madhya Pradesh',
  'Punjab',
  'Andhra Pradesh',
];

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingInvoice,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [placeOfSupply, setPlaceOfSupply] = useState('Karnataka');
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('Payment due within 15 days of invoice date.');
  const [items, setItems] = useState<ItemRow[]>([
    {
      productId: '',
      description: '',
      unit: 'PCS',
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxRate: 18,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIssueImmediate, setIsIssueImmediate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key to close modal
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

  // Protect against accidental refresh / navigation with unsaved form data
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen]);

  // Initialize or populate editing invoice
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    Promise.all([fetchCustomers(), fetchProducts()]).then(([cRes, pRes]) => {
      setCustomers(cRes.customers);
      setProducts(pRes.products);

      if (editingInvoice) {
        setCustomerId(editingInvoice.customerId);
        setInvoiceDate(editingInvoice.invoiceDate);
        setDueDate(editingInvoice.dueDate);
        setPlaceOfSupply(editingInvoice.placeOfSupply || 'Karnataka');
        setIsInterState(Boolean(editingInvoice.isInterState));
        setNotes(editingInvoice.notes || '');
        if (editingInvoice.items && editingInvoice.items.length > 0) {
          setItems(
            editingInvoice.items.map((it) => ({
              productId: it.productId || '',
              description: it.descriptionSnapshot,
              unit: it.unit || 'PCS',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discountAmount: it.discountAmount || 0,
              taxRate: it.taxRate || 0,
            }))
          );
        } else {
          fetchInvoiceDetails(editingInvoice.id)
            .then((fullInv) => {
              if (fullInv && fullInv.items && fullInv.items.length > 0) {
                setItems(
                  fullInv.items.map((it) => ({
                    productId: it.productId || '',
                    description: it.descriptionSnapshot,
                    unit: it.unit || 'PCS',
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    discountAmount: it.discountAmount || 0,
                    taxRate: it.taxRate || 0,
                  }))
                );
              }
            })
            .catch((fetchErr) => {
              console.error('Failed to load full invoice items for draft editing:', fetchErr);
            });
        }
      } else {
        if (cRes.customers.length > 0 && !customerId) {
          setCustomerId(cRes.customers[0].id);
          const firstState = cRes.customers[0].state || 'Karnataka';
          setPlaceOfSupply(firstState);
          setIsInterState(firstState.toLowerCase() !== 'karnataka');
        }
      }
    }).catch((err) => {
      console.error('Failed to load customers or products:', err);
    });
  }, [isOpen, editingInvoice]);

  // Selected customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  // Update place of supply when customer changes (if not explicitly overridden)
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    const cust = customers.find((c) => c.id === newCustId);
    if (cust && cust.state) {
      setPlaceOfSupply(cust.state);
      setIsInterState(cust.state.toLowerCase() !== 'karnataka');
    }
  };

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const next = [...items];
    if (prod) {
      next[index] = {
        ...next[index],
        productId: prod.id,
        description: prod.name,
        unit: prod.unit || 'PCS',
        unitPrice: prod.unitPrice,
        taxRate: prod.taxRate,
      };
    } else {
      next[index] = {
        ...next[index],
        productId: '',
      };
    }
    setItems(next);
  };

  const updateItemField = <K extends keyof ItemRow>(index: number, field: K, value: ItemRow[K]) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      {
        productId: '',
        description: '',
        unit: 'PCS',
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        taxRate: 18,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Live client estimation for instantaneous responsive UI feedback
  const clientTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxableAmount = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const calculatedRows = items.map((it) => {
      const qty = Math.max(0, it.quantity || 0);
      const price = Math.max(0, it.unitPrice || 0);
      const gross = Math.round(qty * price * 100) / 100;
      const disc = Math.min(gross, Math.max(0, it.discountAmount || 0));
      const taxable = Math.round((gross - disc) * 100) / 100;
      const rate = Math.max(0, it.taxRate || 0);
      const tax = Math.round(taxable * (rate / 100) * 100) / 100;
      const lineTot = Math.round((taxable + tax) * 100) / 100;

      subtotal += gross;
      discountTotal += disc;
      taxableAmount += taxable;
      taxTotal += tax;
      grandTotal += lineTot;

      return {
        gross,
        taxable,
        tax,
        lineTot,
      };
    });

    const cgstTotal = isInterState ? 0 : Math.round((taxTotal / 2) * 100) / 100;
    const sgstTotal = isInterState ? 0 : Math.round((taxTotal - cgstTotal) * 100) / 100;
    const igstTotal = isInterState ? taxTotal : 0;

    return {
      subtotal,
      discountTotal,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      taxTotal,
      grandTotal,
      rows: calculatedRows,
    };
  }, [items, isInterState]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const handleSubmit = async (shouldIssueNow: boolean = false) => {
    try {
      setError(null);
      if (!customerId) {
        setError('Please select a customer for this invoice.');
        return;
      }

      if (items.length === 0) {
        setError('At least one item is required.');
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.description.trim()) {
          setError(`Item #${i + 1} description is required.`);
          return;
        }
        if (it.quantity <= 0) {
          setError(`Item #${i + 1} quantity must be greater than zero.`);
          return;
        }
        if (it.unitPrice < 0) {
          setError(`Item #${i + 1} unit price cannot be negative.`);
          return;
        }
        const gross = it.quantity * it.unitPrice;
        if (it.discountAmount > gross) {
          setError(`Item #${i + 1} discount (₹${it.discountAmount}) cannot exceed gross total (₹${gross}).`);
          return;
        }
      }

      setIsSubmitting(true);
      setIsIssueImmediate(shouldIssueNow);

      const payload = {
        customerId,
        invoiceDate,
        dueDate,
        placeOfSupply,
        isInterState,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId || null,
          descriptionSnapshot: it.description.trim(),
          unit: it.unit || 'PCS',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount || 0),
          taxRate: Number(it.taxRate || 0),
        })),
      };

      let savedInvoice: Invoice;
      if (editingInvoice) {
        savedInvoice = await updateDraftInvoice(editingInvoice.id, payload);
      } else {
        savedInvoice = await createInvoice(payload);
      }

      // If issue was requested, perform atomic issuance
      if (shouldIssueNow && savedInvoice.status === 'DRAFT') {
        const issued = await issueInvoice(savedInvoice.id);
        onSuccess(issued);
      } else {
        onSuccess(savedInvoice);
      }

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save invoice';
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setIsIssueImmediate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-navy-950/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shadow-xs">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {editingInvoice ? `Edit Draft Invoice (${editingInvoice.invoiceNumber})` : 'Create New Invoice'}
              </h2>
              <p className="text-xs text-slate-400">
                GST compliant business billing and customer invoicing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-2">✕</button>
            </div>
          )}

          {/* Section 1: Customer & Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 text-xs">
            {/* Customer Picker */}
            <div className="space-y-1.5">
              <label htmlFor="select-customer-input" className="font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" />
                Select Customer *
              </label>
              <select
                id="select-customer-input"
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.gstin ? `(GSTIN: ${c.gstin})` : ''}
                  </option>
                ))}
              </select>

              {selectedCustomer && (
                <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-900">{selectedCustomer.name}</div>
                  <div>{selectedCustomer.billingAddress}</div>
                  <div className="flex gap-3 text-slate-500">
                    <span>Phone: {selectedCustomer.phone}</span>
                    {selectedCustomer.gstin && <span className="font-mono">GSTIN: {selectedCustomer.gstin}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Dates & Reference */}
            <div className="space-y-3">
              <div>
                <label htmlFor="invoice-date-input" className="font-semibold text-slate-700 block mb-1">Invoice Date *</label>
                <input
                  id="invoice-date-input"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label htmlFor="due-date-input" className="font-semibold text-slate-700 block mb-1">Due Date *</label>
                <input
                  id="due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Place of Supply & GST Split Mode */}
            <div className="space-y-3">
              <div>
                <label htmlFor="place-of-supply-select" className="font-semibold text-slate-700 block mb-1">Place of Supply (State)</label>
                <select
                  id="place-of-supply-select"
                  value={placeOfSupply}
                  onChange={(e) => {
                    const st = e.target.value;
                    setPlaceOfSupply(st);
                    setIsInterState(st.toLowerCase() !== 'karnataka');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Supply Tax Treatment</span>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsInterState(false)}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                      !isInterState
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Intra-State (CGST + SGST)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInterState(true)}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                      isInterState
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Inter-State (IGST)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                Line Items ({items.length})
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-48">Product / Catalog</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Description</th>
                    <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                    <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-2 w-28 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 w-24 text-right">Disc (₹)</th>
                    <th className="py-2.5 px-2 w-24 text-right">GST Rate</th>
                    <th className="py-2.5 px-2 w-28 text-right">Taxable</th>
                    <th className="py-2.5 px-3 w-28 text-right">Line Total</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const rowCalc = clientTotals.rows[idx] || { gross: 0, taxable: 0, tax: 0, lineTot: 0 };
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Catalog Select */}
                        <td className="py-2 px-2">
                          <select
                            value={row.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800"
                          >
                            <option value="">-- Custom Item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{p.unitPrice})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                            placeholder="Description..."
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 font-medium"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-1">
                          <select
                            value={row.unit}
                            onChange={(e) => updateItemField(idx, 'unit', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-center font-mono"
                          >
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.quantity || ''}
                            onChange={(e) => updateItemField(idx, 'quantity', Number.parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-right font-mono"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.unitPrice || ''}
                            onChange={(e) => updateItemField(idx, 'unitPrice', Number.parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-right font-mono font-medium"
                          />
                        </td>

                        {/* Discount Amount */}
                        <td className="py-2 px-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.discountAmount || ''}
                            onChange={(e) => updateItemField(idx, 'discountAmount', Number.parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-right font-mono text-emerald-700"
                          />
                        </td>

                        {/* Tax Rate */}
                        <td className="py-2 px-1">
                          <select
                            value={row.taxRate}
                            onChange={(e) => updateItemField(idx, 'taxRate', Number.parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-right font-mono font-medium"
                          >
                            {GST_RATES.map((r) => (
                              <option key={r} value={r}>
                                {r}%
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Taxable Amount */}
                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                          {formatCurrency(rowCalc.taxable)}
                        </td>

                        {/* Line Total */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(rowCalc.lineTot)}
                        </td>

                        {/* Delete Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            aria-label={`Remove line item ${idx + 1}`}
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            className={`p-1 rounded text-slate-400 hover:text-red-600 transition-colors ${
                              items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Notes & Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="invoice-notes-textarea" className="text-xs font-semibold text-slate-700 block">Notes & Terms of Payment</label>
              <textarea
                id="invoice-notes-textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment instructions, bank account details or terms..."
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            {/* Calculations Summary Panel */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 py-0.5">
                <span>Subtotal (Before Discount):</span>
                <span className="font-mono font-semibold">{formatCurrency(clientTotals.subtotal)}</span>
              </div>
              {clientTotals.discountTotal > 0 && (
                <div className="flex justify-between text-slate-600 py-0.5">
                  <span>Total Line Discounts:</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    -{formatCurrency(clientTotals.discountTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 font-medium py-0.5">
                <span>Taxable Subtotal:</span>
                <span className="font-mono">{formatCurrency(clientTotals.taxableAmount)}</span>
              </div>

              {/* GST Tax Breakdown */}
              <div className="py-1 border-t border-slate-200 space-y-1">
                {isInterState ? (
                  <div className="flex justify-between text-slate-600">
                    <span>IGST (Integrated GST):</span>
                    <span className="font-mono">{formatCurrency(clientTotals.igstTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (Central GST):</span>
                      <span className="font-mono">{formatCurrency(clientTotals.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (State GST):</span>
                      <span className="font-mono">{formatCurrency(clientTotals.sgstTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-700 font-semibold pt-0.5">
                  <span>Total Tax (GST):</span>
                  <span className="font-mono">{formatCurrency(clientTotals.taxTotal)}</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm font-extrabold text-slate-950">
                <span>Grand Total:</span>
                <span className="font-mono text-base font-extrabold text-slate-950">
                  {formatCurrency(clientTotals.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Official sequential numbering assigned only upon issuance.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
            >
              {isSubmitting && !isIssueImmediate ? 'Saving Draft...' : 'Save Draft'}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs transition-colors"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              <span>{isSubmitting && isIssueImmediate ? 'Issuing...' : 'Save & Issue Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
