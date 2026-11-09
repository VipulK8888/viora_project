import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';
import { parseDateRangeIST } from '../../utils/dateHelper';

const router = Router();

const isValidCalendarDate = (val: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(`${val}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
};

const dashboardQuerySchema = z.object({
  startDate: z.string().refine(isValidCalendarDate, 'Invalid startDate (YYYY-MM-DD)').optional(),
  endDate: z.string().refine(isValidCalendarDate, 'Invalid endDate (YYYY-MM-DD)').optional(),
});

/**
 * GET /api/dashboard/summary
 * Calculates real financial and operational metrics from PostgreSQL database records.
 * Supports date range filtering while strictly distinguishing:
 * - Total Sales (by invoice date, excluding drafts)
 * - Total Invoices (issued invoices count in reporting period)
 * - Total Payments Collected (by payment date)
 * - Outstanding Payments (remaining balance on issued invoices)
 */
router.get(
  '/summary',
  validateRequest({ query: dashboardQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

      const dateRange = parseDateRangeIST(startDate, endDate);

      // 1. Issued invoices filter (by invoiceDate, drafts and cancelled excluded)
      const invoiceWhere: Prisma.InvoiceWhereInput = {
        businessId: business.id,
        status: 'ISSUED',
      };

      if (dateRange) {
        invoiceWhere.invoiceDate = dateRange;
      }

      const issuedInvoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          grandTotal: true,
          invoiceDate: true,
          payments: {
            select: {
              amount: true,
              paymentDate: true,
            },
          },
        },
      });

      // 2. Draft invoices count in period (or overall)
      const draftWhere: Prisma.InvoiceWhereInput = {
        businessId: business.id,
        status: 'DRAFT',
      };
      if (dateRange) {
        draftWhere.invoiceDate = dateRange;
      }
      const draftCount = await prisma.invoice.count({ where: draftWhere });

      // 3. Payments collected in period (by paymentDate)
      const paymentWhere: Prisma.PaymentWhereInput = {
        invoice: {
          businessId: business.id,
          status: 'ISSUED',
        },
      };
      if (dateRange) {
        paymentWhere.paymentDate = dateRange;
      }
      const periodPayments = await prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amount: true,
        },
      });

      let totalCollected = toDecimal(0);
      for (const p of periodPayments) {
        totalCollected = totalCollected.plus(toDecimal(p.amount));
      }
      totalCollected = round2(totalCollected);

      // 4. Calculate Total Sales and Outstanding Balances for issued invoices
      let totalIssuedSales = toDecimal(0);
      let paidCount = 0;
      let partialCount = 0;
      let unpaidCount = 0;
      let outstandingBalance = toDecimal(0);

      for (const inv of issuedInvoices) {
        const gTotal = toDecimal(inv.grandTotal);
        totalIssuedSales = totalIssuedSales.plus(gTotal);

        let invoicePaid = toDecimal(0);
        for (const p of inv.payments) {
          invoicePaid = invoicePaid.plus(toDecimal(p.amount));
        }
        invoicePaid = round2(invoicePaid);

        const rem = gTotal.minus(invoicePaid).isNegative() ? toDecimal(0) : gTotal.minus(invoicePaid);
        outstandingBalance = outstandingBalance.plus(rem);

        if (gTotal.isZero() || invoicePaid.greaterThanOrEqualTo(gTotal)) {
          paidCount++;
        } else if (invoicePaid.greaterThan(0)) {
          partialCount++;
        } else {
          unpaidCount++;
        }
      }

      totalIssuedSales = round2(totalIssuedSales);
      outstandingBalance = round2(outstandingBalance);

      // 5. Customer and product counts
      const [customerCount, productCount] = await Promise.all([
        prisma.customer.count({
          where: { businessId: business.id, isArchived: false },
        }),
        prisma.product.count({
          where: { businessId: business.id, isArchived: false, isActive: true },
        }),
      ]);

      const collectionRate = totalIssuedSales.greaterThan(0)
        ? Number(
            totalCollected
              .dividedBy(totalIssuedSales)
              .times(100)
              .toDecimalPlaces(1)
          )
        : 0;

      const summary = {
        isMock: false,
        business: {
          id: business.id,
          name: business.name,
        },
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        metrics: {
          totalSales: {
            amount: Number(totalIssuedSales),
            currency: 'INR',
            label: 'Total Issued Sales',
          },
          totalInvoices: {
            count: issuedInvoices.length,
            draftCount,
            paidCount,
            partialCount,
            unpaidCount,
            label: 'Total Invoices',
          },
          amountCollected: {
            amount: Number(totalCollected),
            collectionRate,
            currency: 'INR',
            label: 'Total Payments Collected',
          },
          outstandingBalance: {
            amount: Number(outstandingBalance),
            currency: 'INR',
            label: 'Outstanding Payments',
          },
        },
        counts: {
          customers: customerCount,
          products: productCount,
        },
      };

      return sendSuccess(res, summary, 'Dashboard summary calculated successfully from database');
    } catch (error) {
      next(error);
    }
  }
);

export const dashboardRouter = router;
