import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  MessageSquare,
  Mail,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Play,
  Layers,
  History,
  Phone,
  FlaskConical,
  X,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ReminderQueueData, ReminderLogItem, ReminderQueueItem } from '../../types';
import {
  fetchReminderQueue,
  fetchReminderLogs,
  runAutomatedReminders,
  sendInvoiceWhatsAppReminder,
  sendInvoiceEmailReminder,
  sendInvoiceBothReminders,
  testReminderSimulation,
} from '../../services/api';

export const RemindersView: React.FC = () => {
  const [data, setData] = useState<ReminderQueueData | null>(null);
  const [logs, setLogs] = useState<ReminderLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'LOGS'>('QUEUE');
  const [filterType, setFilterType] = useState<'ALL' | 'DUE' | 'COOLDOWN' | 'HIGH'>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningSweep, setIsRunningSweep] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [queueRes, logsRes] = await Promise.all([
        fetchReminderQueue(),
        fetchReminderLogs(50),
      ]);
      setData(queueRes);
      setLogs(logsRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to load reminders data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Test Simulator State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testAmount, setTestAmount] = useState<number>(75000);
  const [testName, setTestName] = useState('Valued Client');
  const [testSimulationResult, setTestSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [emailPreviewTab, setEmailPreviewTab] = useState<'HTML' | 'TEXT'>('HTML');

  const runTestSimulation = async (amt = testAmount, ph = testPhone, em = testEmail) => {
    try {
      setIsSimulating(true);
      const res = await testReminderSimulation({
        amount: amt,
        phone: ph || undefined,
        email: em || undefined,
        customerName: testName || 'Valued Client',
        invoiceNumber: 'INV-TEST-2026',
      });
      setTestSimulationResult(res);
    } catch (err: any) {
      showToast(err.message || 'Simulation failed', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleOpenTestModal = () => {
    setIsTestModalOpen(true);
    if (!testSimulationResult) {
      runTestSimulation(75000);
    }
  };

  const handleRunSweep = async () => {
    try {
      setIsRunningSweep(true);
      const res = await runAutomatedReminders();
      showToast(
        `Automated sweep completed: ${res.dueProcessed} reminders dispatched (${res.skippedCooldown} in cooldown).`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Automated sweep failed', 'error');
    } finally {
      setIsRunningSweep(false);
    }
  };

  const handleSendWhatsApp = async (item: ReminderQueueItem) => {
    try {
      setActionLoadingId(`${item.invoiceId}-wa`);
      const res = await sendInvoiceWhatsAppReminder(item.invoiceId);
      if (res.whatsAppUrl) {
        window.open(res.whatsAppUrl, '_blank');
      }
      showToast(`WhatsApp reminder dispatched for ${item.invoiceNumber}`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send WhatsApp reminder', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendEmail = async (item: ReminderQueueItem) => {
    try {
      setActionLoadingId(`${item.invoiceId}-email`);
      const res = await sendInvoiceEmailReminder(item.invoiceId);
      if (res && (res as any).previewUrl) {
        showToast(`Email dispatched to ${item.customerEmail}! Click Logs tab to view online preview.`, 'success');
      } else {
        showToast(`Email reminder sent to ${item.customerEmail} (${item.invoiceNumber})`, 'success');
      }
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to send email reminder', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendBoth = async (item: ReminderQueueItem) => {
    try {
      setActionLoadingId(`${item.invoiceId}-both`);
      const res = await sendInvoiceBothReminders(item.invoiceId);
      if (res.results?.whatsapp?.whatsAppUrl) {
        window.open(res.results.whatsapp.whatsAppUrl, '_blank');
      }
      showToast(`Both Email and WhatsApp reminders triggered for ${item.invoiceNumber}`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger reminders', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const queue = data?.queue || [];
  const filteredQueue = queue.filter((item) => {
    if (filterType === 'DUE' && !item.isDue) return false;
    if (filterType === 'COOLDOWN' && item.isDue) return false;
    if (filterType === 'HIGH' && item.tier !== 'HIGH') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = item.invoiceNumber.toLowerCase().includes(q);
      const matchCust = item.customerName.toLowerCase().includes(q);
      const matchPhone = item.customerPhone.includes(q);
      return matchNum || matchCust || matchPhone;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs flex items-center gap-2.5 animate-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : toast.type === 'info'
              ? 'bg-slate-900 text-slate-100 border-slate-700'
              : 'bg-slate-900 text-slate-100 border-slate-700'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Automated Reminders</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Amount Cadence Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated WhatsApp & Email follow-ups dispatched in days gaps based on pending amount size
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenTestModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-xs transition-colors"
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
            <span>Test Simulator</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={isRunningSweep || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 text-slate-950 ${isRunningSweep ? 'animate-pulse' : ''}`} />
            <span>{isRunningSweep ? 'Running Sweep...' : 'Run Automated Sweep Now'}</span>
          </button>
        </div>
      </div>

      {/* Cadence Rules Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* High Tier Card */}
        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                High Priority Tier
              </span>
              <div className="text-sm font-bold text-slate-900 mt-2">
                Pending ≥ ₹{data?.cadenceConfig?.highTierMinAmount?.toLocaleString('en-IN') || '50,000'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Dispatched every <strong className="text-rose-600 font-bold">{data?.cadenceConfig?.highTierDaysGap || 3} days</strong>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-sm border border-rose-100">
              {data?.highTierCount ?? 0}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            <span>Frequent follow-up for large balance accounts</span>
          </div>
        </div>

        {/* Medium Tier Card */}
        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                Medium Priority Tier
              </span>
              <div className="text-sm font-bold text-slate-900 mt-2">
                ₹{data?.cadenceConfig?.midTierMinAmount?.toLocaleString('en-IN') || '10,000'} – ₹
                {data?.cadenceConfig?.highTierMinAmount?.toLocaleString('en-IN') || '50,000'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Dispatched every <strong className="text-amber-700 font-bold">{data?.cadenceConfig?.midTierDaysGap || 5} days</strong>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-extrabold text-sm border border-amber-100">
              {data?.midTierCount ?? 0}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Balanced cadence for standard business bills</span>
          </div>
        </div>

        {/* Low Tier Card */}
        <div className="bg-white rounded-xl border border-blue-200/80 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Standard Priority Tier
              </span>
              <div className="text-sm font-bold text-slate-900 mt-2">
                Pending &lt; ₹{data?.cadenceConfig?.midTierMinAmount?.toLocaleString('en-IN') || '10,000'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Dispatched every <strong className="text-blue-600 font-bold">{data?.cadenceConfig?.lowTierDaysGap || 10} days</strong>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-sm border border-blue-100">
              {data?.lowTierCount ?? 0}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Gentle spaced-out notices for minor balances</span>
          </div>
        </div>
      </section>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'QUEUE'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pending Invoices Cadence Queue ({queue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'LOGS'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Dispatch Audit Logs ({logs.length})</span>
        </button>
      </div>

      {activeTab === 'QUEUE' ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
          {/* Queue Filter Bar */}
          <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice #, customer name, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              {[
                { id: 'ALL', label: `All (${queue.length})` },
                { id: 'DUE', label: `Due Now (${data?.dueNowCount ?? 0})` },
                { id: 'COOLDOWN', label: `In Cooldown (${queue.length - (data?.dueNowCount ?? 0)})` },
                { id: 'HIGH', label: `High (≥₹50k)` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterType === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice & Customer</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Amount Tier & Gap</th>
                  <th className="py-3 px-4">Cadence Status</th>
                  <th className="py-3 px-4 text-right">Instant Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No invoices match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => {
                    const isBusy =
                      actionLoadingId === `${item.invoiceId}-wa` ||
                      actionLoadingId === `${item.invoiceId}-email` ||
                      actionLoadingId === `${item.invoiceId}-both`;

                    return (
                      <tr key={item.invoiceId} className="hover:bg-slate-50/70 transition-colors">
                        {/* Invoice & Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <span>{item.invoiceNumber}</span>
                            {item.isOverdue && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">
                                Overdue {item.overdueDays}d
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            {item.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {item.customerPhone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {item.customerPhone}
                              </span>
                            )}
                            {item.customerEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {item.customerEmail}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Outstanding Balance */}
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-sm font-mono text-slate-900">
                            {formatCurrency(item.balanceRemaining)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            of {formatCurrency(item.grandTotal)}
                          </div>
                        </td>

                        {/* Tier & Days Gap */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              item.tier === 'HIGH'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.tier === 'MEDIUM'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {item.tier} • {item.daysGapApplied} Days Gap
                          </span>
                          <div className="text-[11px] text-slate-400 mt-1">
                            {item.reminderCount === 0
                              ? 'No reminders sent yet'
                              : `${item.reminderCount} sent previously`}
                          </div>
                        </td>

                        {/* Cadence Status */}
                        <td className="py-3 px-4">
                          {item.isDue ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span>Due for Reminder</span>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-600 font-medium">
                              <div className="flex items-center gap-1 text-slate-500">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cooldown Active</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Next gap in <strong>{item.daysUntilNext} days</strong>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp Button */}
                            <button
                              onClick={() => handleSendWhatsApp(item)}
                              disabled={isBusy || !item.customerPhone}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-40"
                              title="Send WhatsApp payment reminder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>

                            {/* Email Button */}
                            <button
                              onClick={() => handleSendEmail(item)}
                              disabled={isBusy || !item.customerEmail}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-colors disabled:opacity-40"
                              title="Send HTML Email payment reminder"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-600" />
                              <span>Email</span>
                            </button>

                            {/* Trigger Both Button */}
                            <button
                              onClick={() => handleSendBoth(item)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors disabled:opacity-40"
                              title="Send via both Email and WhatsApp"
                            >
                              <Send className="w-3 h-3 text-amber-400" />
                              <span>Both</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Logs Tab */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Dispatched Reminder Audit Trail
            </h3>
            <span className="text-xs text-slate-500">Last 50 entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Channel</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Amount Pending</th>
                  <th className="py-2.5 px-4">Applied Cadence</th>
                  <th className="py-2.5 px-4">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No reminder dispatches recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(log.sentAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 font-mono">
                        {log.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {log.customerName}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.channel === 'WHATSAPP'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {log.channel === 'WHATSAPP' ? (
                            <MessageSquare className="w-3 h-3" />
                          ) : (
                            <Mail className="w-3 h-3" />
                          )}
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {log.recipient}
                      </td>
                      <td className="py-2.5 px-4 font-bold font-mono text-slate-900">
                        {formatCurrency(log.amountPending)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {log.tier} ({log.daysGapApplied}d gap)
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            {log.status}
                          </span>
                          {log.previewUrl && (
                            <a
                              href={log.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors"
                              title="Inspect delivered sandbox email online"
                            >
                              <span>View Email</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Test Simulator Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Automation Test Simulator</h3>
                  <p className="text-[11px] text-slate-500">
                    Test live WhatsApp dispatch, HTML email rendering, and amount cadence calculations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Preset Amount Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Select or Enter Outstanding Bill Amount (Tests Tier & Days Gap)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTestAmount(75000);
                      runTestSimulation(75000);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      testAmount >= 50000
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">High Tier (3-Day Gap)</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5">₹75,000</div>
                    <div className="text-[10px] text-slate-500">Overdue large balance</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestAmount(25000);
                      runTestSimulation(25000);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      testAmount >= 10000 && testAmount < 50000
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Medium Tier (5-Day Gap)</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5">₹25,000</div>
                    <div className="text-[10px] text-slate-500">Standard business bill</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestAmount(4500);
                      runTestSimulation(4500);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      testAmount < 10000
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Standard Tier (10-Day Gap)</div>
                    <div className="text-sm font-extrabold text-slate-900 mt-0.5">₹4,500</div>
                    <div className="text-[10px] text-slate-500">Minor balance courtesy</div>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Custom Amount (₹):</span>
                  <input
                    type="number"
                    value={testAmount}
                    disabled={isSimulating}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setTestAmount(val);
                      runTestSimulation(val);
                    }}
                    className="w-36 px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-mono font-bold text-slate-900"
                  />
                  {isSimulating && <span className="text-[11px] text-amber-600 font-medium">Calculating cadence...</span>}
                </div>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => {
                      setTestName(e.target.value);
                      runTestSimulation(testAmount, testPhone, testEmail);
                    }}
                    placeholder="e.g. Vipul"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Your Test Mobile / WhatsApp Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => {
                        setTestPhone(e.target.value);
                        runTestSimulation(testAmount, e.target.value, testEmail);
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Clicking WhatsApp opens with this number</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Your Test Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => {
                        setTestEmail(e.target.value);
                        runTestSimulation(testAmount, testPhone, e.target.value);
                      }}
                      placeholder="e.g. you@company.com"
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Sends test email and displays live HTML</span>
                </div>
              </div>

              {/* Simulation Result */}
              {testSimulationResult && (
                <div className="space-y-4 pt-1">
                  {/* Cadence Calculation Pill */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900">{testSimulationResult.cadenceRule}</span>
                        <div className="text-[11px] text-slate-500">
                          {testSimulationResult.simulatedSchedule?.[1]?.action}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 font-mono">
                      {testSimulationResult.daysGap} Days Gap
                    </span>
                  </div>

                  {/* WhatsApp Action Card */}
                  <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900">WhatsApp Reminder Ready</span>
                      </div>
                      <a
                        href={testSimulationResult.whatsapp.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in WhatsApp Live</span>
                      </a>
                    </div>
                    <pre className="p-3 bg-white border border-emerald-100 rounded-lg text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {testSimulationResult.whatsapp.messagePreview}
                    </pre>
                  </div>

                  {/* Email Action & Preview Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-900">HTML Invoice Email Preview</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white p-0.5 border border-slate-200 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setEmailPreviewTab('HTML')}
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            emailPreviewTab === 'HTML' ? 'bg-slate-900 text-white' : 'text-slate-600'
                          }`}
                        >
                          Visual HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailPreviewTab('TEXT')}
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            emailPreviewTab === 'TEXT' ? 'bg-slate-900 text-white' : 'text-slate-600'
                          }`}
                        >
                          Raw Text
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded-lg border border-slate-200">
                      <strong>Subject:</strong> {testSimulationResult.email.subject}
                    </div>

                    {testSimulationResult.previewUrl && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                        <span className="text-indigo-950 font-medium">📬 Test Email dispatched to Ethereal Sandbox:</span>
                        <a
                          href={testSimulationResult.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 underline"
                        >
                          <span>Open Delivered Email Online</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {emailPreviewTab === 'HTML' ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-white">
                        <iframe
                          title="Email Preview"
                          srcDoc={testSimulationResult.email.htmlPreview}
                          className="w-full h-64 border-0"
                        />
                      </div>
                    ) : (
                      <pre className="p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {testSimulationResult.email.textPreview}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
