import nodemailer from 'nodemailer';
import { prisma } from '../config/prisma';
import { getOrCreateDefaultBusiness } from '../utils/businessHelper';

export interface TierCadence {
  tier: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  daysGap: number;
  minAmount: number;
}

export function getTierAndCadence(
  amount: number,
  business: {
    highTierMinAmount?: unknown;
    midTierMinAmount?: unknown;
    highTierDaysGap?: number | null;
    midTierDaysGap?: number | null;
    lowTierDaysGap?: number | null;
  }
): TierCadence {
  const highMin = Number(business.highTierMinAmount) || 50000;
  const midMin = Number(business.midTierMinAmount) || 10000;

  if (amount >= highMin) {
    return {
      tier: 'HIGH',
      label: 'High Priority (≥ ₹' + highMin.toLocaleString('en-IN') + ')',
      daysGap: business.highTierDaysGap ?? 3,
      minAmount: highMin,
    };
  } else if (amount >= midMin) {
    return {
      tier: 'MEDIUM',
      label: 'Medium Priority (₹' + midMin.toLocaleString('en-IN') + ' - ₹' + highMin.toLocaleString('en-IN') + ')',
      daysGap: business.midTierDaysGap ?? 5,
      minAmount: midMin,
    };
  } else {
    return {
      tier: 'LOW',
      label: 'Standard Priority (< ₹' + midMin.toLocaleString('en-IN') + ')',
      daysGap: business.lowTierDaysGap ?? 10,
      minAmount: 0,
    };
  }
}

export function formatInr(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function cleanPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

export function generateWhatsAppMessage(params: {
  customerName: string;
  invoiceNumber: string;
  dueDate: string;
  grandTotal: number;
  balanceRemaining: number;
  isOverdue: boolean;
  overdueDays: number;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  tier: string;
  daysGap: number;
}): string {
  const urgencyHeader = params.isOverdue
    ? `⚠️ *OVERDUE PAYMENT REMINDER* (Past Due: ${params.overdueDays} Days)`
    : `🔔 *PAYMENT REMINDER*`;

  return [
    `${urgencyHeader}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Dear *${params.customerName}*,`,
    ``,
    `Greetings from *${params.businessName}*!`,
    `This is an automated payment follow-up regarding your invoice:`,
    ``,
    `📄 *Invoice No:* ${params.invoiceNumber}`,
    `📅 *Due Date:* ${params.dueDate}`,
    `💵 *Total Invoiced:* ${formatInr(params.grandTotal)}`,
    `💰 *Outstanding Balance:* *${formatInr(params.balanceRemaining)}*`,
    ``,
    `⚡ *Schedule:* ${params.tier} Priority (${params.daysGap}-day follow-up interval)`,
    ``,
    `Kindly process the pending payment at your earliest convenience.`,
    `For electronic fund transfers or UPI inquiries, reach us at:`,
    `• Phone / UPI: ${params.businessPhone}`,
    `• Email: ${params.businessEmail}`,
    ``,
    `If you have already settled this invoice, please disregard this notice.`,
    `Thank you for your valued partnership!`,
    `— *${params.businessName}* (Powered by billv)`,
  ].join('\n');
}

export function generateEmailHtml(params: {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  totalPaid: number;
  balanceRemaining: number;
  isOverdue: boolean;
  overdueDays: number;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessGstin?: string | null;
  tier: string;
  daysGap: number;
}): { subject: string; html: string; text: string } {
  const subject = params.isOverdue
    ? `[Action Required - Overdue] Payment Reminder for Invoice ${params.invoiceNumber} - ${params.businessName}`
    : `Payment Reminder: Invoice ${params.invoiceNumber} (${formatInr(params.balanceRemaining)} Pending) - ${params.businessName}`;

  const text = [
    `Dear ${params.customerName},`,
    ``,
    `This is an automated payment reminder regarding invoice ${params.invoiceNumber}.`,
    `Outstanding Amount: ${formatInr(params.balanceRemaining)}`,
    `Due Date: ${params.dueDate} ${params.isOverdue ? `(OVERDUE by ${params.overdueDays} days)` : ''}`,
    ``,
    `Please settle this balance via Bank Transfer or UPI.`,
    `Contact: ${params.businessPhone} | ${params.businessEmail}`,
    ``,
    `Thank you,`,
    `${params.businessName}`,
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0b0c0e; padding: 24px 32px; color: #ffffff; }
    .brand-title { font-size: 20px; font-weight: 700; color: #f59e0b; margin: 0; }
    .header-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .content { padding: 32px; }
    .alert-banner { background: ${params.isOverdue ? '#fff1f2' : '#fefce8'}; border: 1px solid ${params.isOverdue ? '#fecdd3' : '#fef08a'}; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
    .alert-title { font-weight: 700; color: ${params.isOverdue ? '#9f1239' : '#854d0e'}; font-size: 14px; margin-bottom: 4px; }
    .alert-desc { font-size: 12px; color: #475569; margin: 0; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .row.total { border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #0f172a; }
    .outstanding-amt { color: #dc2626; font-weight: 800; }
    .meta-badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #f3f4f6; color: #4b5563; }
    .btn { display: inline-block; background: #f59e0b; color: #0b0c0e; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 16px; }
    .footer { background: #f1f5f9; padding: 20px 32px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand-title">billv • ${params.businessName}</h1>
      <div class="header-sub">Automated Financial Dispatch & Accounts Receivable</div>
    </div>
    <div class="content">
      <div class="alert-banner">
        <div class="alert-title">${params.isOverdue ? '⚠️ Payment Overdue' : '🔔 Payment Reminder'}</div>
        <div class="alert-desc">
          ${params.isOverdue
            ? `This invoice was due on <strong>${params.dueDate}</strong> and is currently <strong>${params.overdueDays} days past due</strong>.`
            : `A friendly automated reminder that payment for invoice <strong>${params.invoiceNumber}</strong> is due on <strong>${params.dueDate}</strong>.`
          }
        </div>
      </div>

      <p style="font-size: 14px; margin-bottom: 16px;">Dear <strong>${params.customerName}</strong>,</p>
      <p style="font-size: 13px; color: #475569; line-height: 1.5;">
        We appreciate your ongoing business. Please find below the payment summary for your outstanding invoice:
      </p>

      <div class="summary-card">
        <div class="row">
          <span>Invoice Number:</span>
          <strong>${params.invoiceNumber}</strong>
        </div>
        <div class="row">
          <span>Invoice Date:</span>
          <span>${params.invoiceDate}</span>
        </div>
        <div class="row">
          <span>Due Date:</span>
          <span style="font-weight: 600; color: ${params.isOverdue ? '#dc2626' : '#1e293b'};">${params.dueDate}</span>
        </div>
        <div class="row">
          <span>Cadence Tier:</span>
          <span class="meta-badge">${params.tier} (${params.daysGap}-Day Interval)</span>
        </div>
        <div class="row">
          <span>Total Invoiced:</span>
          <span>${formatInr(params.grandTotal)}</span>
        </div>
        <div class="row">
          <span>Amount Settled:</span>
          <span style="color: #16a34a;">${formatInr(params.totalPaid)}</span>
        </div>
        <div class="row total">
          <span>Balance Remaining:</span>
          <span class="outstanding-amt">${formatInr(params.balanceRemaining)}</span>
        </div>
      </div>

      <div style="font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.6;">
        <strong>Remittance Instructions:</strong><br/>
        Please initiate transfer or UPI payment with the invoice number <strong>${params.invoiceNumber}</strong> in the reference.<br/>
        For any billing queries, contact our finance team at <strong>${params.businessEmail}</strong> or <strong>${params.businessPhone}</strong>.
      </div>
    </div>
    <div class="footer">
      ${params.businessName} • ${params.businessAddress}
      ${params.businessGstin ? `<br/>GSTIN: ${params.businessGstin}` : ''}
      <br/><br/>
      Automated accounts receivable dispatch powered by billv.
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
}

// Mailer transporter with fallback
let cachedEtherealAccount: {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
} | null = null;

export async function getTransporter(business?: {
  smtpHost?: string | null;
  smtpPort?: number | string | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpSecure?: boolean | null;
}) {
  const host = business?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(business?.smtpPort || process.env.SMTP_PORT) || 587;
  const user = business?.smtpUser || process.env.SMTP_USER;
  const pass = business?.smtpPass || process.env.SMTP_PASS;
  const secure = business?.smtpSecure ?? (process.env.SMTP_SECURE === 'true');

  if (user && pass) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return {
      isLiveSmtp: true,
      provider: host,
      user,
      transporter,
    };
  }

  // Fallback to real Ethereal email test account for sandbox delivery
  if (!cachedEtherealAccount) {
    try {
      cachedEtherealAccount = await nodemailer.createTestAccount();
    } catch (err) {
      console.warn('[ReminderService] Failed to create Ethereal test account:', err);
    }
  }

  if (cachedEtherealAccount) {
    const transporter = nodemailer.createTransport({
      host: cachedEtherealAccount.smtp.host,
      port: cachedEtherealAccount.smtp.port,
      secure: cachedEtherealAccount.smtp.secure,
      auth: {
        user: cachedEtherealAccount.user,
        pass: cachedEtherealAccount.pass,
      },
    });
    return {
      isLiveSmtp: false,
      provider: 'ethereal.email (Online Test Mailbox)',
      user: cachedEtherealAccount.user,
      transporter,
    };
  }

  // Secondary fallback: stream transport
  return {
    isLiveSmtp: false,
    provider: 'Local Stream Fallback',
    user: 'local',
    transporter: nodemailer.createTransport({
      streamTransport: true,
      newline: 'windows',
    }),
  };
}

export class ReminderService {
  /**
   * Retrieves all issued invoices with outstanding balances, evaluated for reminder cadence.
   */
  static async getReminderQueue() {
    const business = await getOrCreateDefaultBusiness();

    const invoices = await prisma.invoice.findMany({
      where: {
        businessId: business.id,
        status: 'ISSUED',
      },
      include: {
        customer: true,
        payments: true,
        reminderLogs: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const queue = [];

    for (const inv of invoices) {
      const grandTotal = Number(inv.grandTotal);
      const totalPaid = inv.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const balanceRemaining = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);

      if (balanceRemaining <= 0) continue; // fully paid

      const tierInfo = getTierAndCadence(balanceRemaining, business);
      const lastSent = inv.lastReminderSentAt ? new Date(inv.lastReminderSentAt) : null;

      let nextEligibleAt: Date;
      let isDue = false;

      if (!lastSent) {
        nextEligibleAt = now;
        isDue = true;
      } else {
        nextEligibleAt = new Date(lastSent.getTime() + tierInfo.daysGap * 86400000);
        isDue = now >= nextEligibleAt;
      }

      const diffMs = nextEligibleAt.getTime() - now.getTime();
      const daysUntilNext = isDue ? 0 : Math.ceil(diffMs / 86400000);

      const dueDate = new Date(inv.dueDate);
      const isOverdue = now > dueDate;
      const overdueDays = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;

      const customerName = inv.customerNameSnapshot || inv.customer?.name || 'Customer';
      const customerPhone = inv.customerPhoneSnapshot || inv.customer?.phone || '';
      const customerEmail = inv.customerEmailSnapshot || inv.customer?.email || '';

      const waMessage = generateWhatsAppMessage({
        customerName,
        invoiceNumber: inv.invoiceNumber,
        dueDate: inv.dueDate.toISOString().split('T')[0],
        grandTotal,
        balanceRemaining,
        isOverdue,
        overdueDays,
        businessName: business.name,
        businessPhone: business.phone,
        businessEmail: business.email,
        tier: tierInfo.tier,
        daysGap: tierInfo.daysGap,
      });

      const cleanPhone = cleanPhoneForWhatsApp(customerPhone);
      const whatsAppUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`
        : null;

      const emailData = generateEmailHtml({
        customerName,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
        dueDate: inv.dueDate.toISOString().split('T')[0],
        grandTotal,
        totalPaid,
        balanceRemaining,
        isOverdue,
        overdueDays,
        businessName: business.name,
        businessPhone: business.phone,
        businessEmail: business.email,
        businessAddress: business.address,
        businessGstin: business.gstin,
        tier: tierInfo.tier,
        daysGap: tierInfo.daysGap,
      });

      queue.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName,
        customerPhone,
        customerEmail,
        invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
        dueDate: inv.dueDate.toISOString().split('T')[0],
        grandTotal,
        totalPaid,
        balanceRemaining,
        isOverdue,
        overdueDays,
        tier: tierInfo.tier,
        tierLabel: tierInfo.label,
        daysGapApplied: tierInfo.daysGap,
        lastReminderSentAt: inv.lastReminderSentAt?.toISOString() || null,
        reminderCount: inv.reminderCount,
        nextEligibleAt: nextEligibleAt.toISOString(),
        isDue,
        daysUntilNext,
        whatsAppUrl,
        whatsAppMessage: waMessage,
        emailSubject: emailData.subject,
        recentLogs: inv.reminderLogs.map((l) => ({
          id: l.id,
          channel: l.channel,
          recipient: l.recipient,
          status: l.status,
          sentAt: l.sentAt.toISOString(),
        })),
      });
    }

    return {
      totalPendingInvoices: queue.length,
      dueNowCount: queue.filter((q) => q.isDue).length,
      highTierCount: queue.filter((q) => q.tier === 'HIGH').length,
      midTierCount: queue.filter((q) => q.tier === 'MEDIUM').length,
      lowTierCount: queue.filter((q) => q.tier === 'LOW').length,
      cadenceConfig: {
        highTierMinAmount: Number(business.highTierMinAmount),
        highTierDaysGap: business.highTierDaysGap,
        midTierMinAmount: Number(business.midTierMinAmount),
        midTierDaysGap: business.midTierDaysGap,
        lowTierDaysGap: business.lowTierDaysGap,
        autoReminderEnabled: business.autoReminderEnabled,
      },
      queue,
    };
  }

  /**
   * Dispatches WhatsApp reminder for a specific invoice.
   */
  static async sendWhatsAppReminder(invoiceId: string) {
    const business = await getOrCreateDefaultBusiness();
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, payments: true },
    });

    if (!inv) throw new Error('Invoice not found');
    if (inv.status !== 'ISSUED') throw new Error('Reminders can only be sent for issued invoices');

    const grandTotal = Number(inv.grandTotal);
    const totalPaid = inv.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const balanceRemaining = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);

    if (balanceRemaining <= 0) throw new Error('This invoice is already fully paid');

    const customerName = inv.customerNameSnapshot || inv.customer?.name || 'Customer';
    const customerPhone = inv.customerPhoneSnapshot || inv.customer?.phone || '';

    if (!customerPhone) throw new Error('Customer does not have a registered phone number for WhatsApp');

    const tierInfo = getTierAndCadence(balanceRemaining, business);
    const now = new Date();
    const dueDate = new Date(inv.dueDate);
    const isOverdue = now > dueDate;
    const overdueDays = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;

    const messageContent = generateWhatsAppMessage({
      customerName,
      invoiceNumber: inv.invoiceNumber,
      dueDate: inv.dueDate.toISOString().split('T')[0],
      grandTotal,
      balanceRemaining,
      isOverdue,
      overdueDays,
      businessName: business.name,
      businessPhone: business.phone,
      businessEmail: business.email,
      tier: tierInfo.tier,
      daysGap: tierInfo.daysGap,
    });

    const cleanPhone = cleanPhoneForWhatsApp(customerPhone);
    const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageContent)}`;
    const nextEligibleAt = new Date(now.getTime() + tierInfo.daysGap * 86400000);

    // Record audit log and update invoice
    const [log] = await prisma.$transaction([
      prisma.reminderLog.create({
        data: {
          businessId: business.id,
          invoiceId: inv.id,
          customerId: inv.customerId,
          channel: 'WHATSAPP',
          recipient: customerPhone,
          amountPending: balanceRemaining,
          tier: tierInfo.tier,
          daysGapApplied: tierInfo.daysGap,
          status: 'SENT',
          subject: `WhatsApp Reminder: ${inv.invoiceNumber}`,
          messageContent,
          sentAt: now,
          nextEligibleAt,
        },
      }),
      prisma.invoice.update({
        where: { id: inv.id },
        data: {
          lastReminderSentAt: now,
          reminderCount: { increment: 1 },
        },
      }),
    ]);

    return {
      success: true,
      channel: 'WHATSAPP',
      recipient: customerPhone,
      whatsAppUrl,
      messageContent,
      tier: tierInfo.tier,
      daysGapApplied: tierInfo.daysGap,
      nextEligibleAt: nextEligibleAt.toISOString(),
      logId: log.id,
    };
  }

  /**
   * Dispatches Email reminder for a specific invoice.
   */
  static async sendEmailReminder(invoiceId: string) {
    const business = await getOrCreateDefaultBusiness();
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, payments: true },
    });

    if (!inv) throw new Error('Invoice not found');
    if (inv.status !== 'ISSUED') throw new Error('Reminders can only be sent for issued invoices');

    const grandTotal = Number(inv.grandTotal);
    const totalPaid = inv.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const balanceRemaining = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);

    if (balanceRemaining <= 0) throw new Error('This invoice is already fully paid');

    const customerName = inv.customerNameSnapshot || inv.customer?.name || 'Customer';
    const customerEmail = inv.customerEmailSnapshot || inv.customer?.email || '';

    if (!customerEmail) throw new Error('Customer does not have a registered email address');

    const tierInfo = getTierAndCadence(balanceRemaining, business);
    const now = new Date();
    const dueDate = new Date(inv.dueDate);
    const isOverdue = now > dueDate;
    const overdueDays = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;

    const emailData = generateEmailHtml({
      customerName,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      grandTotal,
      totalPaid,
      balanceRemaining,
      isOverdue,
      overdueDays,
      businessName: business.name,
      businessPhone: business.phone,
      businessEmail: business.email,
      businessAddress: business.address,
      businessGstin: business.gstin,
      tier: tierInfo.tier,
      daysGap: tierInfo.daysGap,
    });

    const mailInfo = await getTransporter(business);
    let externalId = `SIM-MAIL-${Date.now()}`;
    let previewUrl: string | null = null;
    const senderEmail = business.smtpUser || business.email || 'billing@vioratech.com';

    try {
      const info = await mailInfo.transporter.sendMail({
        from: `"${business.name}" <${senderEmail}>`,
        to: customerEmail,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      });
      if (info && info.messageId) {
        externalId = info.messageId;
      }
      if (!mailInfo.isLiveSmtp) {
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          previewUrl = testUrl;
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[ReminderService] SMTP delivery notice: ${errorMsg}.`);
      throw new Error(`Email delivery failed: ${errorMsg}. Please configure your SMTP settings in Business Settings.`);
    }

    const nextEligibleAt = new Date(now.getTime() + tierInfo.daysGap * 86400000);

    const [log] = await prisma.$transaction([
      prisma.reminderLog.create({
        data: {
          businessId: business.id,
          invoiceId: inv.id,
          customerId: inv.customerId,
          channel: 'EMAIL',
          recipient: customerEmail,
          amountPending: balanceRemaining,
          tier: tierInfo.tier,
          daysGapApplied: tierInfo.daysGap,
          status: 'SENT',
          subject: emailData.subject,
          messageContent: emailData.text,
          externalId,
          previewUrl,
          sentAt: now,
          nextEligibleAt,
        },
      }),
      prisma.invoice.update({
        where: { id: inv.id },
        data: {
          lastReminderSentAt: now,
          reminderCount: { increment: 1 },
        },
      }),
    ]);

    return {
      success: true,
      channel: 'EMAIL',
      recipient: customerEmail,
      subject: emailData.subject,
      tier: tierInfo.tier,
      daysGapApplied: tierInfo.daysGap,
      nextEligibleAt: nextEligibleAt.toISOString(),
      isLiveSmtp: mailInfo.isLiveSmtp,
      provider: mailInfo.provider,
      previewUrl,
      logId: log.id,
    };
  }

  /**
   * Dispatches both Email and WhatsApp reminder for a specific invoice.
   */
  static async sendBothReminders(invoiceId: string) {
    const results: {
      whatsapp?: { success: boolean; error?: string; [key: string]: unknown };
      email?: { success: boolean; error?: string; [key: string]: unknown };
    } = {};
    try {
      results.whatsapp = await this.sendWhatsAppReminder(invoiceId);
    } catch (err: unknown) {
      results.whatsapp = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    try {
      results.email = await this.sendEmailReminder(invoiceId);
    } catch (err: unknown) {
      results.email = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    return {
      success: Boolean(results.whatsapp?.success || results.email?.success),
      results,
    };
  }

  /**
   * Automated Sweep: Scans all pending invoices and dispatches reminders for any that are due based on their amount-tiered days gap.
   */
  static async runAutomatedCadenceSweep() {
    const queueData = await this.getReminderQueue();
    const dueItems = queueData.queue.filter((item) => item.isDue);

    interface SweepItemResult {
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      balanceRemaining: number;
      tier: string;
      daysGapApplied: number;
      email?: { success: boolean; logId?: string; error?: string };
      whatsapp?: { success: boolean; logId?: string; url?: string; error?: string };
    }
    const sweepResults: SweepItemResult[] = [];

    for (const item of dueItems) {
      const itemResult: SweepItemResult = {
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName,
        balanceRemaining: item.balanceRemaining,
        tier: item.tier,
        daysGapApplied: item.daysGapApplied,
      };

      // Dispatch Email if email is available
      if (item.customerEmail) {
        try {
          const emailRes = await this.sendEmailReminder(item.invoiceId);
          itemResult.email = { success: true, logId: emailRes.logId };
        } catch (err: unknown) {
          itemResult.email = { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      // Dispatch WhatsApp if phone is available
      if (item.customerPhone) {
        try {
          const waRes = await this.sendWhatsAppReminder(item.invoiceId);
          itemResult.whatsapp = { success: true, logId: waRes.logId, url: waRes.whatsAppUrl };
        } catch (err: unknown) {
          itemResult.whatsapp = { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      sweepResults.push(itemResult);
    }

    return {
      totalEvaluated: queueData.queue.length,
      dueProcessed: dueItems.length,
      skippedCooldown: queueData.queue.length - dueItems.length,
      results: sweepResults,
    };
  }

  /**
   * Retrieves historical reminder logs.
   */
  static async getReminderLogs(limit = 50) {
    const business = await getOrCreateDefaultBusiness();
    const logs = await prisma.reminderLog.findMany({
      where: { businessId: business.id },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            grandTotal: true,
            customerNameSnapshot: true,
          },
        },
        customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });

    return logs.map((l) => ({
      id: l.id,
      invoiceId: l.invoiceId,
      invoiceNumber: l.invoice?.invoiceNumber || '—',
      customerName: l.invoice?.customerNameSnapshot || l.customer?.name || 'Customer',
      channel: l.channel,
      recipient: l.recipient,
      amountPending: Number(l.amountPending),
      tier: l.tier,
      daysGapApplied: l.daysGapApplied,
      status: l.status,
      subject: l.subject,
      messageContent: l.messageContent,
      previewUrl: l.previewUrl,
      sentAt: l.sentAt.toISOString(),
      nextEligibleAt: l.nextEligibleAt.toISOString(),
    }));
  }

  /**
   * Updates cadence configuration settings.
   */
  static async updateCadenceConfig(config: {
    highTierMinAmount?: number;
    highTierDaysGap?: number;
    midTierMinAmount?: number;
    midTierDaysGap?: number;
    lowTierDaysGap?: number;
    autoReminderEnabled?: boolean;
  }) {
    const business = await getOrCreateDefaultBusiness();
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        highTierMinAmount: config.highTierMinAmount !== undefined ? config.highTierMinAmount : undefined,
        highTierDaysGap: config.highTierDaysGap !== undefined ? config.highTierDaysGap : undefined,
        midTierMinAmount: config.midTierMinAmount !== undefined ? config.midTierMinAmount : undefined,
        midTierDaysGap: config.midTierDaysGap !== undefined ? config.midTierDaysGap : undefined,
        lowTierDaysGap: config.lowTierDaysGap !== undefined ? config.lowTierDaysGap : undefined,
        autoReminderEnabled: config.autoReminderEnabled !== undefined ? config.autoReminderEnabled : undefined,
      },
    });

    return {
      highTierMinAmount: Number(updated.highTierMinAmount),
      highTierDaysGap: updated.highTierDaysGap,
      midTierMinAmount: Number(updated.midTierMinAmount),
      midTierDaysGap: updated.midTierDaysGap,
      lowTierDaysGap: updated.lowTierDaysGap,
      autoReminderEnabled: updated.autoReminderEnabled,
    };
  }

  /**
   * Interactive Test Simulator:
   * Generates real WhatsApp direct links and HTML email previews for any custom phone, email, and amount.
   */
  static async testReminderSimulation(params: {
    phone?: string;
    email?: string;
    amount?: number;
    customerName?: string;
    invoiceNumber?: string;
  }) {
    const business = await getOrCreateDefaultBusiness();
    const balanceRemaining = Number(params.amount) || 65000;
    const customerName = params.customerName?.trim() || 'Valued Test Client';
    const invoiceNumber = params.invoiceNumber?.trim() || 'INV-TEST-2026';
    const customerPhone = params.phone?.trim() || business.phone;
    const customerEmail = params.email?.trim() || business.email;

    const tierInfo = getTierAndCadence(balanceRemaining, business);
    const now = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 5);
    const isOverdue = true;
    const overdueDays = 5;

    const whatsAppMessage = generateWhatsAppMessage({
      customerName,
      invoiceNumber,
      dueDate: dueDate.toISOString().split('T')[0],
      grandTotal: balanceRemaining,
      balanceRemaining,
      isOverdue,
      overdueDays,
      businessName: business.name,
      businessPhone: business.phone,
      businessEmail: business.email,
      tier: tierInfo.tier,
      daysGap: tierInfo.daysGap,
    });

    const cleanPhone = cleanPhoneForWhatsApp(customerPhone);
    const whatsAppUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`;

    const emailData = generateEmailHtml({
      customerName,
      invoiceNumber,
      invoiceDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      grandTotal: balanceRemaining,
      totalPaid: 0,
      balanceRemaining,
      isOverdue,
      overdueDays,
      businessName: business.name,
      businessPhone: business.phone,
      businessEmail: business.email,
      businessAddress: business.address,
      businessGstin: business.gstin,
      tier: tierInfo.tier,
      daysGap: tierInfo.daysGap,
    });

    let emailDispatched = false;
    let emailMessageId: string | null = null;
    let previewUrl: string | null = null;
    let isLiveSmtp = false;
    let mailProvider = 'Simulated';

    if (params.email) {
      try {
        const mailInfo = await getTransporter(business);
        isLiveSmtp = mailInfo.isLiveSmtp;
        mailProvider = mailInfo.provider;
        const senderEmail = business.smtpUser || business.email || 'billing@vioratech.com';

        const info = await mailInfo.transporter.sendMail({
          from: `"${business.name}" <${senderEmail}>`,
          to: params.email,
          subject: `[TEST] ${emailData.subject}`,
          text: emailData.text,
          html: emailData.html,
        });
        emailDispatched = true;
        emailMessageId = info?.messageId || 'TEST-ID';
        if (!mailInfo.isLiveSmtp) {
          previewUrl = nodemailer.getTestMessageUrl(info) || null;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn('[ReminderService] Test email notice:', errorMsg);
      }
    }

    const nextEligibleAt = new Date(now.getTime() + tierInfo.daysGap * 86400000);

    return {
      testedAmount: balanceRemaining,
      tier: tierInfo.tier,
      tierLabel: tierInfo.label,
      daysGap: tierInfo.daysGap,
      cadenceRule: `Amount ₹${balanceRemaining.toLocaleString('en-IN')} falls into ${tierInfo.tier} tier -> ${tierInfo.daysGap} Days Gap enforced`,
      simulatedSchedule: [
        { day: 'Day 0 (Today)', action: 'First automated reminder dispatched via WhatsApp & Email' },
        { day: `Day 1 to Day ${tierInfo.daysGap - 1}`, action: `Cooldown active: ${tierInfo.daysGap - 1} days protected from reminder spam` },
        { day: `Day ${tierInfo.daysGap}`, action: `Next reminder eligible and dispatched automatically at ${nextEligibleAt.toLocaleDateString('en-IN')}` },
      ],
      whatsapp: {
        recipient: customerPhone,
        cleanPhone,
        url: whatsAppUrl,
        messagePreview: whatsAppMessage,
      },
      email: {
        recipient: customerEmail,
        subject: emailData.subject,
        htmlPreview: emailData.html,
        textPreview: emailData.text,
        dispatched: emailDispatched,
        messageId: emailMessageId,
        previewUrl,
        isLiveSmtp,
        provider: mailProvider,
      },
    };
  }

  /**
   * Tests SMTP configuration by verifying connection and sending a real test email to an inbox.
   */
  static async testSmtpConnection(settings: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    smtpSecure?: boolean;
    testEmail: string;
  }) {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure ?? (settings.smtpPort === 465),
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    // 1. Verify credentials and connectivity
    await transporter.verify();

    // 2. Send test email to target testEmail
    const info = await transporter.sendMail({
      from: `"billv Invoicing" <${settings.smtpUser}>`,
      to: settings.testEmail,
      subject: '✅ billv SMTP Email Delivery Test Successful!',
      text: 'Congratulations! Your SMTP email delivery has been successfully configured and verified. Real invoice bills and payment reminders will now arrive directly in your customers\' inboxes.',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #f59e0b; margin-top: 0;">🎉 SMTP Connection Verified!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Your email delivery system is fully operational.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px; font-size: 13px; color: #475569; margin: 16px 0;">
            <strong>Host:</strong> ${settings.smtpHost}<br/>
            <strong>User:</strong> ${settings.smtpUser}<br/>
            <strong>Delivered To:</strong> ${settings.testEmail}
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Sent by billv automated financial dispatch engine.
          </p>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
      recipient: settings.testEmail,
      isLiveSmtp: true,
      provider: settings.smtpHost,
    };
  }
}
