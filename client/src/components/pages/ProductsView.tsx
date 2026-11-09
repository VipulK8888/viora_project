import React, { useState, useEffect, useCallback } from 'react';
import { Product } from '../../types';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../services/api';
import {
  Package,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  Tag,
  ToggleLeft,
  ToggleRight,
  FileEdit,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [unitPrice, setUnitPrice] = useState('');
  const [taxRate, setTaxRate] = useState('18');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchProducts({ search: searchQuery });
      setProducts(res.products);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load products';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setUnit('PCS');
    setUnitPrice('');
    setTaxRate('18');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setDescription(p.description || '');
    setUnit(p.unit || 'PCS');
    setUnitPrice(String(p.unitPrice));
    setTaxRate(String(p.taxRate ?? 18));
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unitPrice) return;

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          unit: unit.trim().toUpperCase(),
          unitPrice: Number(unitPrice),
          taxRate: Number(taxRate) || 0,
        });
        setToastMessage('Product updated successfully');
      } else {
        await createProduct({
          name: name.trim(),
          description: description.trim() || undefined,
          unit: unit.trim().toUpperCase(),
          unitPrice: Number(unitPrice),
          taxRate: Number(taxRate) || 0,
        });
        setToastMessage('Product created successfully');
      }

      setTimeout(() => setToastMessage(null), 3000);
      setIsModalOpen(false);
      setEditingProduct(null);
      setName('');
      setDescription('');
      setUnit('PCS');
      setUnitPrice('');
      setTaxRate('18');
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving product';
      alert(`Error saving product: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      await updateProduct(product.id, { isActive: !product.isActive });
      setToastMessage(
        product.isActive ? 'Product marked inactive' : 'Product marked active'
      );
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating product';
      alert(`Error updating product: ${msg}`);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to remove ${product.name}?`)) return;

    try {
      await deleteProduct(product.id);
      setToastMessage('Product removed/archived');
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error removing product';
      alert(`Error removing product: ${msg}`);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Products & Services</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your pricing catalog, billing units, and tax rates
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search and Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, unit, or description..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <div className="text-xs text-slate-400 ml-auto hidden sm:block">
          Total: {products.length} catalog items
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-medium">Loading catalog items...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-rose-900">Failed to load products</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">No products found</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-5">
            {searchQuery
              ? 'No catalog items match your search filter.'
              : 'Add items or services to easily populate your invoices.'}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Item / Service</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Tax Rate</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      {p.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-md">
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                        {p.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(Number(p.unitPrice))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
                        <Tag className="w-3 h-3" />
                        {Number(p.taxRate)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {p.isActive ? (
                          <>
                            <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          title="Edit Product Details"
                          aria-label={`Edit ${p.name}`}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          title="Delete or Archive Product"
                          aria-label={`Delete ${p.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingProduct ? 'Edit Product / Service' : 'Add Product or Service'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Item catalog pricing and tax specifications
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label htmlFor="prod-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Product / Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="prod-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cloud Infrastructure Consulting"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="prod-desc-textarea" className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  id="prod-desc-textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of item or scope of service"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="prod-unit-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="prod-unit-select"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="HRS">HRS (Hours)</option>
                    <option value="MONTH">MONTH</option>
                    <option value="YR">YR (Year)</option>
                    <option value="BOX">BOX</option>
                    <option value="KGS">KGS</option>
                    <option value="SET">SET</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prod-price-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="prod-price-input"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="2500"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="prod-tax-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax Rate (%)
                  </label>
                  <select
                    id="prod-tax-select"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% (GST)</option>
                    <option value="12">12% (GST)</option>
                    <option value="18">18% (Standard GST)</option>
                    <option value="28">28% (Luxury)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
