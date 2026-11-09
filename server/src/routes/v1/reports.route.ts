import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';
import { parseDateRangeIST, formatPeriodKeyIST } from '../../utils/dateHelper';

const router = Router();

const isValidCalendarDate = (val: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(`${val}T00:00:00Z`);
  return !isNaN(parsed.getTime());
};

const salesReportQuerySchema = z.object({
  startDate: z.string().refine(isValidCalendarDate, 'Invalid startDate (YYYY-MM-DD)').optional(),
  endDate: z.string().refine(isValidCalendarDate, 'Invalid endDate (YYYY-MM-DD)').optional(),
  groupBy: z.enum(['day', 'month']).optional().default('day'),
});

/**
 * GET /api/reports/sales
 * Generates sales and collections report with daily or monthly aggregation.
 * Excludes DRAFT invoices from sales calculations.
 * Keeps sales (by invoice date) distinct from collections (by payment date).
 */
router.get(
  '/sales',
  validateRequest({ query: salesReportQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { startDate, endDate, groupBy } = req.query as any;

      // 1. Invoices filter (ISSUED invoices only)
      const invoiceWhere: any = {
        businessId: business.id,
        status: 'ISSUED',
      };

      const dateRange = parseDateRangeIST(startDate, endDate);
      if (dateRange) {
        invoiceWhere.invoiceDate = dateRange;
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { invoiceDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          subtotal: true,
          discountTotal: true,
          taxTotal: true,
          grandTotal: true,
          payments: {
            select: { amount: true },
          },
        },
      });

      // 2. Payments filter (Collections by payment date in IST)
      const paymentWhere: any = {
        invoice: {
          businessId: business.id,
          status: 'ISSUED',
        },
      };

      if (dateRange) {
        paymentWhere.paymentDate = dateRange;
      }

      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { paymentDate: 'asc' },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true,
        },
      });

      // Helper to format date key in documented business timezone (Asia/Kolkata)
      const formatPeriodKey = (d: Date): string => formatPeriodKeyIST(d, groupBy);

      // Aggregate Sales by Invoice Date
      const salesAggregation: Record<
        string,
        {
          period: string;
          invoiceCount: number;
          subtotal: number;
          discountTotal: number;
          taxTotal: number;
          grandTotal: number;
        }
      > = {};

      let totalSales = toDecimal(0);
      let totalTax = toDecimal(0);
      let totalDiscount = toDecimal(0);
      let periodUnpaidReceivables = toDecimal(0);

      for (const inv of invoices) {
        const key = formatPeriodKey(inv.invoiceDate);
        if (!salesAggregation[key]) {
          salesAggregation[key] = {
            period: key,
            invoiceCount: 0,
            subtotal: 0,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: 0,
          };
        }

        salesAggregation[key].invoiceCount += 1;
        salesAggregation[key].subtotal = Number(
          round2(toDecimal(salesAggregation[key].subtotal).plus(inv.subtotal))
        );
        salesAggregation[key].discountTotal = Number(
          round2(toDecimal(salesAggregation[key].discountTotal).plus(inv.discountTotal))
        );
        salesAggregation[key].taxTotal = Number(
          round2(toDecimal(salesAggregation[key].taxTotal).plus(inv.taxTotal))
        );
        salesAggregation[key].grandTotal = Number(
          round2(toDecimal(salesAggregation[key].grandTotal).plus(inv.grandTotal))
        );

        totalSales = totalSales.plus(inv.grandTotal);
        totalTax = totalTax.plus(inv.taxTotal);
        totalDiscount = totalDiscount.plus(inv.discountTotal);

        const paidOnInvoice = inv.payments.reduce((acc, p) => acc.plus(toDecimal(p.amount)), toDecimal(0));
        const bal = toDecimal(inv.grandTotal).minus(paidOnInvoice);
        if (bal.greaterThan(0)) {
          periodUnpaidReceivables = periodUnpaidReceivables.plus(bal);
        }
      }

      // Aggregate Collections by Payment Date
      const collectionsAggregation: Record<
        string,
        {
          period: string;
          paymentCount: number;
          totalCollected: number;
        }
      > = {};

      let totalCollected = toDecimal(0);

      for (const p of payments) {
        const key = formatPeriodKey(p.paymentDate);
        if (!collectionsAggregation[key]) {
          collectionsAggregation[key] = {
            period: key,
            paymentCount: 0,
            totalCollected: 0,
          };
        }

        collectionsAggregation[key].paymentCount += 1;
        collectionsAggregation[key].totalCollected = Number(
          round2(toDecimal(collectionsAggregation[key].totalCollected).plus(p.amount))
        );

        totalCollected = totalCollected.plus(p.amount);
      }

      // Calculate total outstanding receivables for business overall
      const allIssued = await prisma.invoice.findMany({
        where: { businessId: business.id, status: 'ISSUED' },
        select: {
          grandTotal: true,
          payments: { select: { amount: true } },
        },
      });
      let totalAllOutstanding = toDecimal(0);
      for (const inv of allIssued) {
        const paid = inv.payments.reduce((acc, p) => acc.plus(toDecimal(p.amount)), toDecimal(0));
        const bal = toDecimal(inv.grandTotal).minus(paid);
        if (bal.greaterThan(0)) {
          totalAllOutstanding = totalAllOutstanding.plus(bal);
        }
      }

      const salesTimeline = Object.values(salesAggregation).sort((a, b) =>
        a.period.localeCompare(b.period)
      );
      const collectionsTimeline = Object.values(collectionsAggregation).sort((a, b) =>
        a.period.localeCompare(b.period)
      );

      return sendSuccess(
        res,
        {
          filters: {
            startDate: startDate || null,
            endDate: endDate || null,
            groupBy,
          },
          summary: {
            totalIssuedInvoices: invoices.length,
            totalSales: Number(round2(totalSales)),
            totalTax: Number(round2(totalTax)),
            totalDiscount: Number(round2(totalDiscount)),
            totalCollected: Number(round2(totalCollected)),
            totalPayments: payments.length,
            periodUnpaidReceivables: Number(round2(periodUnpaidReceivables)),
            totalOutstandingReceivables: Number(round2(totalAllOutstanding)),
            periodNetCashFlow: Number(round2(totalSales.minus(totalCollected))),
            netOutstanding: Number(round2(periodUnpaidReceivables)),
          },
          salesTimeline,
          collectionsTimeline,
        },
        'Sales report generated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

export const reportsRouter = router;
