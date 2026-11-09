import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { derivePaymentStatus, round2, toDecimal } from '../../utils/money';
import { parseDateRangeIST } from '../../utils/dateHelper';

const router = Router();

export const createPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Payment amount must be greater than zero')
    .max(100000000, 'Payment amount cannot exceed ₹100,000,000')
    .refine((val) => {
      const parts = Number(val).toString().split('.');
      return parts.length === 1 || parts[1].length <= 2;
    }, 'Payment amount cannot have more than 2 decimal places (fractional paisa is not allowed)'),
  paymentDate: z
    .string()
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      message: 'Invalid payment date format',
    })
    .optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
  reference: z.string().optional().nullable(),
  requestKey: z.string().min(4, 'Idempotency requestKey is required to prevent duplicate payments'),
});

const getPaymentsQuerySchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  method: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * GET /api/payments
 * Lists all recorded payments with invoice metadata, customer filter, search, and date filters
 */
router.get(
  '/',
  validateRequest({ query: getPaymentsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { invoiceId, customerId, search, method, startDate, endDate, page, limit } = req.query as unknown as {
        invoiceId?: string;
        customerId?: string;
        search?: string;
        method?: string;
        startDate?: string;
        endDate?: string;
        page: number;
        limit: number;
      };

      const where: Prisma.PaymentWhereInput = {
        invoice: {
          businessId: business.id,
        },
      };

      if (invoiceId) {
        where.invoiceId = invoiceId;
      }

      if (customerId) {
        where.invoice = {
          businessId: business.id,
          customerId,
        };
      }

      if (method && method !== 'ALL') {
        where.method = method as 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
      }

      const dateRange = parseDateRangeIST(startDate, endDate);
      if (dateRange) {
        where.paymentDate = dateRange;
      }

      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { invoice: { invoiceNumber: { contains: term, mode: 'insensitive' } } },
          { invoice: { customerNameSnapshot: { contains: term, mode: 'insensitive' } } },
          { invoice: { customer: { name: { contains: term, mode: 'insensitive' } } } },
          { reference: { contains: term, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.payment.count({ where });
      const payments = await prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              grandTotal: true,
              customerNameSnapshot: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      });

      return sendSuccess(
        res,
        {
          payments: payments.map((p) => ({
            id: p.id,
            invoiceId: p.invoiceId,
            invoiceNumber: p.invoice.invoiceNumber,
            customerId: p.invoice.customer?.id,
            customerName: p.invoice.customerNameSnapshot || p.invoice.customer.name,
            amount: Number(p.amount),
            paymentDate: p.paymentDate.toISOString().split('T')[0],
            method: p.method,
            reference: p.reference,
            requestKey: p.requestKey,
            createdAt: p.createdAt,
          })),
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Payments retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper to record payment on an invoice (used by POST /api/invoices/:id/payments)
 * Protects against concurrent requests via PostgreSQL row-level locks (FOR UPDATE)
 * and strict transactional balance recalculation and idempotency checking.
 */
export async function handleRecordPayment(
  invoiceId: string,
  rawBody: z.infer<typeof createPaymentSchema>
) {
  const body = createPaymentSchema.parse(rawBody);
  const paymentAmount = round2(toDecimal(body.amount));

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Check duplicate requestKey inside transaction
      const existingPayment = await tx.payment.findUnique({
        where: { requestKey: body.requestKey.trim() },
      });
      if (existingPayment) {
        throw new AppError(
          `Duplicate payment submission detected for requestKey: ${body.requestKey}`,
          409,
          'ERR_DUPLICATE_PAYMENT_REQUEST'
        );
      }

      // 2. Lock invoice row FOR UPDATE to safely serialize concurrent payment attempts
      const lockedInvoices = await tx.$queryRaw<
        Array<{
          id: string;
          invoiceNumber: string;
          grandTotal: string | number | Prisma.Decimal;
          status: string;
        }>
      >`
        SELECT id, "invoiceNumber", "grandTotal", status
        FROM "invoices"
        WHERE id = ${invoiceId}
        FOR UPDATE
      `;

      if (!lockedInvoices || lockedInvoices.length === 0) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      const invoice = lockedInvoices[0];

      if (invoice.status !== 'ISSUED') {
        throw new AppError(
          `Cannot record payment for an invoice in ${invoice.status} status. Only ISSUED invoices can receive payments.`,
          400,
          'ERR_INVALID_INVOICE_STATUS'
        );
      }

      // 3. Recalculate balance inside transaction
      const existingPayments = await tx.payment.findMany({
        where: { invoiceId },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
          method: true,
          reference: true,
          requestKey: true,
          createdAt: true,
        },
      });

      const currentStatus = derivePaymentStatus(invoice.grandTotal, existingPayments);
      if (currentStatus.paymentStatus === 'PAID' || currentStatus.balanceRemaining.lessThanOrEqualTo(0)) {
        throw new AppError('This invoice has already been fully paid', 400, 'ERR_INVOICE_ALREADY_PAID');
      }

      // 4. Validate that payment amount does not exceed remaining balance
      if (paymentAmount.greaterThan(currentStatus.balanceRemaining)) {
        throw new AppError(
          `Payment amount (₹${paymentAmount.toString()}) exceeds outstanding balance (₹${currentStatus.balanceRemaining.toString()})`,
          400,
          'ERR_OVERPAYMENT_REJECTED'
        );
      }

      // 5. Insert payment
      const paymentDateObj = body.paymentDate ? new Date(body.paymentDate) : new Date();

      const newPayment = await tx.payment.create({
        data: {
          invoiceId,
          amount: paymentAmount,
          paymentDate: paymentDateObj,
          method: body.method,
          reference: body.reference ? body.reference.trim() : null,
          requestKey: body.requestKey.trim(),
        },
      });

      // 6. Recalculate updated status
      const updatedPayments = [...existingPayments, newPayment];
      const updatedStatus = derivePaymentStatus(invoice.grandTotal, updatedPayments);

      return {
        payment: {
          ...newPayment,
          amount: Number(newPayment.amount),
        },
        invoiceSummary: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          grandTotal: Number(invoice.grandTotal),
          paymentStatus: updatedStatus.paymentStatus,
          totalPaid: Number(updatedStatus.totalPaid),
          balanceRemaining: Number(updatedStatus.balanceRemaining),
        },
      };
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      const meta = (error as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes('requestKey')) {
        throw new AppError(
          `Duplicate payment submission detected for requestKey: ${body.requestKey}`,
          409,
          'ERR_DUPLICATE_PAYMENT_REQUEST'
        );
      }
    }
    throw error;
  }
}

export const paymentsRouter = router;
