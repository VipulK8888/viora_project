import React, { useState, useEffect, useCallback } from 'react';
import { BusinessProfile } from '../../types';
import { fetchBusiness, updateBusiness, testSmtpConnection } from '../../services/api';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Server,
  Eye,
  EyeOff,
  ExternalLink,
  Send,
  Key,
  ShieldCheck,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Karnataka');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState('');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean;
    message: string;
    previewUrl?: string;
    isLiveSmtp?: boolean;
    provider?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBusiness();
      setBusiness(data);
      setName(data.name || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setGstin(data.gstin || '');
      setState(data.state || 'Karnataka');
      setInvoicePrefix(data.invoicePrefix || 'INV');

      // Load SMTP configs
      setSmtpHost(data.smtpHost || 'smtp.gmail.com');
      setSmtpPort(data.smtpPort || 587);
      setSmtpUser(data.smtpUser || '');
      setSmtpPass(data.smtpPass || '');
      setSmtpSecure(Boolean(data.smtpSecure));
      setSmtpFrom(data.smtpFrom || '');
      setTestRecipientEmail(data.smtpUser || data.email || '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load business profile';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !phone.trim() || !email.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateBusiness({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim() || null,
        state: state.trim() || 'Karnataka',
        invoicePrefix: invoicePrefix.trim().toUpperCase(),
        smtpHost: smtpHost.trim() || null,
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim() || null,
        smtpPass: smtpPass.trim() || null,
        smtpSecure: Boolean(smtpSecure),
        smtpFrom: smtpFrom.trim() || null,
      });
      setBusiness(updated);
      setSuccessMsg('Business and email settings saved successfully');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save business settings';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await testSmtpConnection({
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpUser: smtpUser.trim() || undefined,
        smtpPass: smtpPass.trim() || undefined,
        smtpSecure,
        testEmail: testRecipientEmail.trim() || email.trim(),
      });
      setSmtpTestResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP Connection Test Failed';
      setSmtpTestResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Business Settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure company details, GSTIN tax identifiers, and automated invoice numbering
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-slate-400 font-medium">Loading organization profile...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-3 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Business Identification */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Legal Business Information</h3>
            </div>

            <div>
              <label htmlFor="biz-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Legal Entity Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="biz-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Viora Tech Solutions Pvt Ltd"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-email-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="biz-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="billing@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="biz-phone-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="biz-phone-input"
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="biz-address-textarea" className="block text-xs font-semibold text-slate-700 mb-1">
                Official Registered Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <textarea
                  id="biz-address-textarea"
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, City, State, PIN code"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-gstin-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN (Tax Identification Number)
                </label>
                <input
                  id="biz-gstin-input"
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="biz-state-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  State of Registration (for GST Supply Determination)
                </label>
                <input
                  id="biz-state-input"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Karnataka"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Invoice Numbering Configuration */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-slate-900">Invoice Numbering Sequence</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-prefix-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number Prefix
                </label>
                <input
                  id="biz-prefix-input"
                  type="text"
                  maxLength={10}
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="INV"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Example generated format: <code className="text-amber-700 font-bold">{invoicePrefix || 'INV'}-{new Date().getFullYear()}-000001</code>
                </span>
              </div>

              <div>
                <label htmlFor="biz-next-seq-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Sequence Counter
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="biz-next-seq-input"
                    type="text"
                    disabled
                    value={business?.nextInvoiceNumber ?? 1}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Sequentially assigned upon invoice issuance
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Email Dispatch & SMTP Server Configuration */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Email Dispatch & SMTP Configuration</h3>
                  <p className="text-[11px] text-slate-400">Configure your email provider to send real invoices directly to client inboxes</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                smtpUser ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {smtpUser ? 'Custom SMTP Connected' : 'Sandbox Fallback Active'}
              </span>
            </div>

            {/* Explanatory Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">
                    Why didn't my test email arrive in my real inbox?
                  </p>
                  <p className="leading-relaxed">
                    By default, when no outgoing mail server is connected, billv sends emails through a safe <strong>Ethereal Sandbox</strong>. In this mode, no real emails reach physical inboxes, but a <strong>live online preview link</strong> is generated for every invoice sent.
                  </p>
                  <p className="leading-relaxed">
                    To deliver real emails to your personal or customer Gmail inboxes, enter your Gmail details below using a 16-character Google App Password.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Gmail Guide */}
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-1.5 text-indigo-950">
              <span className="font-bold flex items-center gap-1.5 text-indigo-900">
                <Key className="w-3.5 h-3.5" /> 30-Second Gmail Setup Guide:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-indigo-900/90 leading-relaxed">
                <li>Make sure <strong>2-Step Verification</strong> is enabled in your Google Account.</li>
                <li>Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold hover:text-indigo-700">myaccount.google.com/apppasswords</a>.</li>
                <li>Enter "billv" as the App Name, click <strong>Create</strong>, and copy the 16-letter password into the field below.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="biz-smtp-host-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Host Server
                </label>
                <input
                  id="biz-smtp-host-input"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="biz-smtp-port-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Port
                </label>
                <input
                  id="biz-smtp-port-input"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                  placeholder="587"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-smtp-user-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Username / Email
                </label>
                <input
                  id="biz-smtp-user-input"
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="youraccount@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="biz-smtp-pass-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  SMTP Password / App Password
                </label>
                <div className="relative">
                  <input
                    id="biz-smtp-pass-input"
                    type={showSmtpPassword ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="16-character App Password"
                    className="w-full pl-3 pr-9 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showSmtpPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSmtpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label htmlFor="biz-smtp-from-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom "From" Header (Optional)
                </label>
                <input
                  id="biz-smtp-from-input"
                  type="text"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder='e.g. "billv Billing" &lt;billing@company.com&gt;'
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="smtpSecureToggle"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="smtpSecureToggle" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Use SSL/TLS (Enabled for port 465, leave unchecked for 587)
                </label>
              </div>
            </div>

            {/* Real-time SMTP Connection Test Box */}
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-indigo-600" /> Test Mail Delivery Live
                </span>
                <span className="text-[11px] text-slate-400">Verifies credentials and sends a test message</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="Enter email to receive test message..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={isTestingSmtp}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {isTestingSmtp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>

              {smtpTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start gap-2.5 ${
                    smtpTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {smtpTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{smtpTestResult.message}</p>
                    {smtpTestResult.previewUrl && (
                      <div className="pt-1">
                        <a
                          href={smtpTestResult.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 underline"
                        >
                          <span>Open delivered message in Ethereal Sandbox</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
