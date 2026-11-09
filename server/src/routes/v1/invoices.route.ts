import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { parseDateRangeIST, formatDateDisplay } from '../../utils/dateHelper';
import {
  calculateInvoiceTotals,
  derivePaymentStatus,
  round2,
  toDecimal,
} from '../../utils/money';
import { generateInvoicePdfStream, InvoicePdfData } from '../../services/pdf.service';
import { createPaymentSchema, handleRecordPayment } from './payments.route';

const router = Router();

const invoiceItemSchema = z.object({
  productId: z.string().optional().nullable(),
  descriptionSnapshot: z.string().min(1, 'Item description is required').max(255),
  unit: z.string().optional().default('PCS'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero').max(1000000, 'Quantity cannot exceed 1,000,000'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative').max(100000000, 'Unit price cannot exceed ₹100,000,000'),
  discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').max(100000000).optional().default(0),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').optional().default(0),
});

const isValidCalendarDate = (val: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(`${val}T00:00:00Z`);
  return !isNaN(parsed.getTime());
};

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.string().refine(isValidCalendarDate, 'Invalid invoice date (YYYY-MM-DD)'),
  dueDate: z.string().refine(isValidCalendarDate, 'Invalid due date (YYYY-MM-DD)'),
  placeOfSupply: z.string().optional().nullable(),
  isInterState: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
});

const updateInvoiceSchema = createInvoiceSchema;

const getInvoicesQuerySchema = z.object({
  status: z.enum(['ALL', 'DRAFT', 'ISSUED', 'CANCELLED']).optional().default('ALL'),
  paymentStatus: z.enum(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID']).optional().default('ALL'),
  customerId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * GET /api/invoices
 * Lists invoices with search, status filters, pagination, and derived payment statuses
 */
router.get(
  '/',
  validateRequest({ query: getInvoicesQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const {
        status,
        paymentStatus,
        customerId,
        search,
        startDate,
        endDate,
        page,
        limit,
      } = req.query as any;

      const where: any = {
        businessId: business.id,
      };

      if (status !== 'ALL') {
        where.status = status;
      }

      if (customerId) {
        where.customerId = customerId;
      }

      const dateRange = parseDateRangeIST(startDate, endDate);
      if (dateRange) {
        where.invoiceDate = dateRange;
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { customerNameSnapshot: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      let invoices: any[] = [];
      let totalCount = 0;

      if (paymentStatus === 'ALL') {
        totalCount = await prisma.invoice.count({ where });
        const rawInvoices = await prisma.invoice.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { invoiceDate: 'desc' },
          include: {
            customer: {
              select: { id: true, name: true, email: true, phone: true, state: true },
            },
            payments: {
              select: { amount: true },
            },
          },
        });

        invoices = rawInvoices.map((inv) => {
          const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);
          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.customerId,
            customerName: inv.customerNameSnapshot || inv.customer.name,
            customerEmail: inv.customerEmailSnapshot || inv.customer.email,
            invoiceDate: formatDateDisplay(inv.invoiceDate),
            dueDate: formatDateDisplay(inv.dueDate),
            status: inv.status,
            placeOfSupply: inv.placeOfSupply,
            isInterState: inv.isInterState,
            subtotal: Number(inv.subtotal),
            discountTotal: Number(inv.discountTotal),
            taxableAmount: Number(inv.taxableAmount),
            cgstTotal: Number(inv.cgstTotal),
            sgstTotal: Number(inv.sgstTotal),
            igstTotal: Number(inv.igstTotal),
            taxTotal: Number(inv.taxTotal),
            grandTotal: Number(inv.grandTotal),
            paymentStatus: paymentInfo.paymentStatus,
            totalPaid: Number(paymentInfo.totalPaid),
            balanceRemaining: Number(paymentInfo.balanceRemaining),
            createdAt: inv.createdAt,
          };
        });
      } else {
        // Query candidate invoices matching base filters and derive exact paymentStatus
        const candidates = await prisma.invoice.findMany({
          where,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            grandTotal: true,
            payments: {
              select: { amount: true },
            },
          },
        });

        const matchingIds = candidates
          .filter((inv) => derivePaymentStatus(inv.grandTotal, inv.payments).paymentStatus === paymentStatus)
          .map((inv) => inv.id);

        totalCount = matchingIds.length;
        const pageIds = matchingIds.slice((page - 1) * limit, page * limit);

        if (pageIds.length > 0) {
          const rawInvoices = await prisma.invoice.findMany({
            where: { id: { in: pageIds } },
            orderBy: { invoiceDate: 'desc' },
            include: {
              customer: {
                select: { id: true, name: true, email: true, phone: true, state: true },
              },
              payments: {
                select: { amount: true },
              },
            },
          });

          invoices = rawInvoices.map((inv) => {
            const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);
            return {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              customerId: inv.customerId,
              customerName: inv.customerNameSnapshot || inv.customer.name,
              customerEmail: inv.customerEmailSnapshot || inv.customer.email,
              invoiceDate: formatDateDisplay(inv.invoiceDate),
              dueDate: formatDateDisplay(inv.dueDate),
              status: inv.status,
              placeOfSupply: inv.placeOfSupply,
              isInterState: inv.isInterState,
              subtotal: Number(inv.subtotal),
              discountTotal: Number(inv.discountTotal),
              taxableAmount: Number(inv.taxableAmount),
              cgstTotal: Number(inv.cgstTotal),
              sgstTotal: Number(inv.sgstTotal),
              igstTotal: Number(inv.igstTotal),
              taxTotal: Number(inv.taxTotal),
              grandTotal: Number(inv.grandTotal),
              paymentStatus: paymentInfo.paymentStatus,
              totalPaid: Number(paymentInfo.totalPaid),
              balanceRemaining: Number(paymentInfo.balanceRemaining),
              createdAt: inv.createdAt,
            };
          });
        }
      }

      return sendSuccess(
        res,
        {
          invoices,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Invoices retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/invoices/:id
 * Returns single invoice with line items, payments, snapshots and derived balance
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        business: true,
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    const isIssued = inv.status === 'ISSUED';
    const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);

    return sendSuccess(
      res,
      {
        ...inv,
        customerName: (isIssued && inv.customerNameSnapshot) || inv.customer.name,
        customerPhone: (isIssued && inv.customerPhoneSnapshot) || inv.customer.phone,
        customerEmail: (isIssued && inv.customerEmailSnapshot) || inv.customer.email,
        customer: {
          ...inv.customer,
          name: (isIssued && inv.customerNameSnapshot) || inv.customer.name,
          phone: (isIssued && inv.customerPhoneSnapshot) || inv.customer.phone,
          email: (isIssued && inv.customerEmailSnapshot) || inv.customer.email,
          billingAddress: (isIssued && inv.customerAddressSnapshot) || inv.customer.billingAddress,
          gstin: (isIssued && inv.customerGstinSnapshot !== undefined) ? inv.customerGstinSnapshot : inv.customer.gstin,
          state: (isIssued && inv.customerStateSnapshot) || inv.customer.state,
        },
        business: {
          ...inv.business,
          name: (isIssued && inv.businessNameSnapshot) || inv.business.name,
          address: (isIssued && inv.businessAddressSnapshot) || inv.business.address,
          phone: (isIssued && inv.businessPhoneSnapshot) || inv.business.phone,
          email: (isIssued && inv.businessEmailSnapshot) || inv.business.email,
          gstin: (isIssued && inv.businessGstinSnapshot !== undefined) ? inv.businessGstinSnapshot : inv.business.gstin,
          state: (isIssued && inv.businessStateSnapshot) || inv.business.state,
        },
        invoiceDate: formatDateDisplay(inv.invoiceDate),
        dueDate: formatDateDisplay(inv.dueDate),
        subtotal: Number(inv.subtotal),
        discountTotal: Number(inv.discountTotal),
        taxableAmount: Number(inv.taxableAmount),
        cgstTotal: Number(inv.cgstTotal),
        sgstTotal: Number(inv.sgstTotal),
        igstTotal: Number(inv.igstTotal),
        taxTotal: Number(inv.taxTotal),
        grandTotal: Number(inv.grandTotal),
        paymentStatus: paymentInfo.paymentStatus,
        totalPaid: Number(paymentInfo.totalPaid),
        balanceRemaining: Number(paymentInfo.balanceRemaining),
        items: inv.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount),
          taxRate: Number(it.taxRate),
          taxableAmount: Number(it.taxableAmount),
          cgstRate: Number(it.cgstRate),
          cgstAmount: Number(it.cgstAmount),
          sgstRate: Number(it.sgstRate),
          sgstAmount: Number(it.sgstAmount),
          igstRate: Number(it.igstRate),
          igstAmount: Number(it.igstAmount),
          taxAmount: Number(it.taxAmount),
          lineTotal: Number(it.lineTotal),
        })),
        payments: inv.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          paymentDate: formatDateDisplay(p.paymentDate),
        })),
      },
      'Invoice details retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id/pdf
 * Returns professional A4 PDF for invoice with snapshots and tax breakdowns
 */
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        business: true,
        customer: true,
        items: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!inv) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    const paymentInfo = derivePaymentStatus(inv.grandTotal, inv.payments);

    const pdfData: InvoicePdfData = {
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      status: inv.status,
      placeOfSupply: inv.placeOfSupply || 'Karnataka',
      isInterState: inv.isInterState,
      notes: inv.notes,
      subtotal: Number(inv.subtotal),
      discountTotal: Number(inv.discountTotal),
      taxableAmount: Number(inv.taxableAmount),
      cgstTotal: Number(inv.cgstTotal),
      sgstTotal: Number(inv.sgstTotal),
      igstTotal: Number(inv.igstTotal),
      taxTotal: Number(inv.taxTotal),
      grandTotal: Number(inv.grandTotal),
      totalPaid: Number(paymentInfo.totalPaid),
      balanceRemaining: Number(paymentInfo.balanceRemaining),
      paymentStatus: paymentInfo.paymentStatus,
      business: {
        name: inv.businessNameSnapshot || inv.business.name,
        address: inv.businessAddressSnapshot || inv.business.address,
        phone: inv.businessPhoneSnapshot || inv.business.phone,
        email: inv.businessEmailSnapshot || inv.business.email,
        gstin: inv.businessGstinSnapshot || inv.business.gstin,
        state: inv.businessStateSnapshot || inv.business.state,
      },
      customer: {
        name: inv.customerNameSnapshot || inv.customer.name,
        phone: inv.customerPhoneSnapshot || inv.customer.phone,
        email: inv.customerEmailSnapshot || inv.customer.email,
        address: inv.customerAddressSnapshot || inv.customer.billingAddress,
        gstin: inv.customerGstinSnapshot || inv.customer.gstin,
        state: inv.customerStateSnapshot || inv.customer.state,
      },
      items: inv.items.map((it) => ({
        description: it.descriptionSnapshot,
        unit: it.unitSnapshot || it.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discountAmount: Number(it.discountAmount),
        taxableAmount: Number(it.taxableAmount),
        taxRate: Number(it.taxRate),
        cgstAmount: Number(it.cgstAmount),
        sgstAmount: Number(it.sgstAmount),
        igstAmount: Number(it.igstAmount),
        taxAmount: Number(it.taxAmount),
        lineTotal: Number(it.lineTotal),
      })),
      payments: inv.payments.map((p) => ({
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString().split('T')[0],
        method: p.method,
        reference: p.reference,
      })),
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${inv.invoiceNumber}.pdf"`
    );

    const pdfStream = generateInvoicePdfStream(pdfData);
    pdfStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices
 * Creates a DRAFT invoice with full server-side GST financial calculations
 */
router.post(
  '/',
  validateRequest({ body: createInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { customerId, invoiceDate, dueDate, placeOfSupply, isInterState: explicitInterState, notes, items } = req.body;

      // Validate customer existence
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId: business.id },
      });
      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }
      if (customer.isArchived) {
        throw new AppError('Cannot create an invoice for an archived customer', 400, 'ERR_CUSTOMER_ARCHIVED');
      }

      // Validate dates
      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invDateObj) {
        throw new AppError('Due date cannot precede invoice date', 400, 'ERR_INVALID_DATES');
      }

      // Validate product existence if productId provided
      const productIds = items
        .map((i: any) => i.productId)
        .filter((pid: any): pid is string => typeof pid === 'string' && pid.trim().length > 0);
      if (productIds.length > 0) {
        const existingProducts = await prisma.product.findMany({
          where: { id: { in: productIds }, businessId: business.id },
          select: { id: true },
        });
        const foundSet = new Set(existingProducts.map((p) => p.id));
        for (const pid of productIds) {
          if (!foundSet.has(pid)) {
            throw new AppError(`Product with id "${pid}" not found`, 400, 'ERR_PRODUCT_NOT_FOUND');
          }
        }
      }

      // Determine Inter-state supply (IGST) vs Intra-state supply (CGST+SGST)
      const resolvedSupplyPlace = placeOfSupply ? placeOfSupply.trim() : (customer.state || business.state || 'Karnataka');
      const isInterState = typeof explicitInterState === 'boolean'
        ? explicitInterState
        : resolvedSupplyPlace.toLowerCase() !== (business.state || 'karnataka').toLowerCase();

      // Calculate totals strictly on the server
      let calculated;
      try {
        calculated = calculateInvoiceTotals(items, isInterState);
      } catch (calcErr: any) {
        throw new AppError(calcErr.message || 'Invoice calculation error', 400, 'ERR_INVALID_INVOICE_CALCULATION');
      }

      if (calculated.grandTotal.lessThanOrEqualTo(0)) {
        throw new AppError('Invoice grand total must be greater than zero', 400, 'ERR_ZERO_TOTAL_INVOICE');
      }

      // Collision-resistant unique draft identifier
      const draftNumber = `DRAFT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            invoiceNumber: draftNumber,
            invoiceDate: invDateObj,
            dueDate: dueDateObj,
            status: 'DRAFT',
            placeOfSupply: resolvedSupplyPlace,
            isInterState,
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxableAmount: calculated.taxableAmount,
            cgstTotal: calculated.cgstTotal,
            sgstTotal: calculated.sgstTotal,
            igstTotal: calculated.igstTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            // Pre-seed customer snapshots
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            customerStateSnapshot: customer.state || resolvedSupplyPlace,
            businessNameSnapshot: business.name,
            businessAddressSnapshot: business.address,
            businessPhoneSnapshot: business.phone,
            businessEmailSnapshot: business.email,
            businessGstinSnapshot: business.gstin,
            businessStateSnapshot: business.state,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                unit: item.unit,
                unitSnapshot: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                cgstRate: item.cgstRate,
                cgstAmount: item.cgstAmount,
                sgstRate: item.sgstRate,
                sgstAmount: item.sgstAmount,
                igstRate: item.igstRate,
                igstAmount: item.igstAmount,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });

        return created;
      });

      return sendSuccess(res, invoice, 'Draft invoice created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/invoices/:id
 * Strictly draft invoices can be edited. Issued invoices are IMMUTABLE.
 */
router.put(
  '/:id',
  validateRequest({ body: updateInvoiceSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { customerId, invoiceDate, dueDate, placeOfSupply, isInterState: explicitInterState, notes, items } = req.body;

      const existing = await prisma.invoice.findUnique({
        where: { id },
        include: { business: true },
      });

      if (!existing) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      if (existing.status !== 'DRAFT') {
        throw new AppError(
          `Only draft invoices can be edited. This invoice is already ${existing.status}.`,
          400,
          'ERR_INVOICE_NOT_DRAFT'
        );
      }

      const invDateObj = new Date(invoiceDate);
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < invDateObj) {
        throw new AppError('Due date cannot precede invoice date', 400, 'ERR_INVALID_DATES');
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }
      if (customer.isArchived) {
        throw new AppError('Cannot update an invoice with an archived customer', 400, 'ERR_CUSTOMER_ARCHIVED');
      }

      const business = existing.business;
      const resolvedSupplyPlace = placeOfSupply ? placeOfSupply.trim() : (customer.state || business.state || 'Karnataka');
      const isInterState = typeof explicitInterState === 'boolean'
        ? explicitInterState
        : resolvedSupplyPlace.toLowerCase() !== (business.state || 'karnataka').toLowerCase();

      // Validate product existence if productId provided
      const productIds = items
        .map((i: any) => i.productId)
        .filter((pid: any): pid is string => typeof pid === 'string' && pid.trim().length > 0);
      if (productIds.length > 0) {
        const existingProducts = await prisma.product.findMany({
          where: { id: { in: productIds }, businessId: business.id },
          select: { id: true },
        });
        const foundSet = new Set(existingProducts.map((p) => p.id));
        for (const pid of productIds) {
          if (!foundSet.has(pid)) {
            throw new AppError(`Product with id "${pid}" not found`, 400, 'ERR_PRODUCT_NOT_FOUND');
          }
        }
      }

      let calculated;
      try {
        calculated = calculateInvoiceTotals(items, isInterState);
      } catch (calcErr: any) {
        throw new AppError(calcErr.message || 'Invoice calculation error', 400, 'ERR_INVALID_INVOICE_CALCULATION');
      }

      if (calculated.grandTotal.lessThanOrEqualTo(0)) {
        throw new AppError('Invoice grand total must be greater than zero', 400, 'ERR_ZERO_TOTAL_INVOICE');
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Remove existing items
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        // Update invoice and re-create items
        return tx.invoice.update({
          where: { id },
          data: {
            customerId: customer.id,
            invoiceDate: invDateObj,
            dueDate: dueDateObj,
            placeOfSupply: resolvedSupplyPlace,
            isInterState,
            subtotal: calculated.subtotal,
            discountTotal: calculated.discountTotal,
            taxableAmount: calculated.taxableAmount,
            cgstTotal: calculated.cgstTotal,
            sgstTotal: calculated.sgstTotal,
            igstTotal: calculated.igstTotal,
            taxTotal: calculated.taxTotal,
            grandTotal: calculated.grandTotal,
            notes: notes ? notes.trim() : null,
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerEmailSnapshot: customer.email,
            customerAddressSnapshot: customer.billingAddress,
            customerGstinSnapshot: customer.gstin,
            customerStateSnapshot: customer.state || resolvedSupplyPlace,
            items: {
              create: calculated.items.map((item) => ({
                productId: item.productId,
                descriptionSnapshot: item.descriptionSnapshot,
                unit: item.unit,
                unitSnapshot: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount,
                taxRate: item.taxRate,
                taxableAmount: item.taxableAmount,
                cgstRate: item.cgstRate,
                cgstAmount: item.cgstAmount,
                sgstRate: item.sgstRate,
                sgstAmount: item.sgstAmount,
                igstRate: item.igstRate,
                igstAmount: item.igstAmount,
                taxAmount: item.taxAmount,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });
      });

      return sendSuccess(res, updated, 'Draft invoice updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/invoices/:id/issue
 * Issues a draft invoice: row-locks invoice, locks snapshots, assigns sequential official invoice number in transaction
 */
router.post('/:id/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Atomic transaction with row locking to prevent race conditions & duplicate sequence allocation
    const issuedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Lock invoice row FOR UPDATE
      const lockedRows: any[] = await tx.$queryRaw`
        SELECT id, status, "businessId", "grandTotal", "customerId", "placeOfSupply"
        FROM "invoices"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      const locked = lockedRows[0];

      if (locked.status === 'ISSUED') {
        throw new AppError('Invoice has already been issued', 400, 'ERR_ALREADY_ISSUED');
      }

      if (locked.status === 'CANCELLED') {
        throw new AppError('Cancelled invoices cannot be issued', 400, 'ERR_CANNOT_ISSUE_CANCELLED');
      }

      if (locked.status !== 'DRAFT') {
        throw new AppError(`Only draft invoices can be issued (current status: ${locked.status})`, 400, 'ERR_INVOICE_NOT_DRAFT');
      }

      if (Number(locked.grandTotal) <= 0) {
        throw new AppError('Cannot issue an invoice with zero or negative total amount', 400, 'ERR_ZERO_TOTAL_INVOICE');
      }

      const itemsCount = await tx.invoiceItem.count({ where: { invoiceId: id } });
      if (itemsCount === 0) {
        throw new AppError('Cannot issue an invoice with zero items', 400, 'ERR_EMPTY_INVOICE');
      }

      const customer = await tx.customer.findUnique({ where: { id: locked.customerId } });
      if (!customer) {
        throw new AppError('Customer not found for this invoice', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      // 2. Atomic sequence allocation on business
      const updatedBusiness = await tx.business.update({
        where: { id: locked.businessId },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      });

      const assignedSequence = updatedBusiness.nextInvoiceNumber - 1;
      const currentYear = new Date().getFullYear();
      const officialNumber = `${updatedBusiness.invoicePrefix}-${currentYear}-${String(
        assignedSequence
      ).padStart(6, '0')}`;

      // 3. Lock snapshots permanently and transition to ISSUED
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: officialNumber,
          status: 'ISSUED',
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customerEmailSnapshot: customer.email,
          customerAddressSnapshot: customer.billingAddress,
          customerGstinSnapshot: customer.gstin,
          customerStateSnapshot: customer.state || locked.placeOfSupply,
          businessNameSnapshot: updatedBusiness.name,
          businessAddressSnapshot: updatedBusiness.address,
          businessPhoneSnapshot: updatedBusiness.phone,
          businessEmailSnapshot: updatedBusiness.email,
          businessGstinSnapshot: updatedBusiness.gstin,
          businessStateSnapshot: updatedBusiness.state,
        },
        include: {
          customer: true,
          items: true,
        },
      });

      return updated;
    });

    return sendSuccess(
      res,
      issuedInvoice,
      `Invoice ${issuedInvoice.invoiceNumber} has been officially issued`
    );
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/invoices/:id
 * Deletes a DRAFT invoice. Issued or cancelled invoices cannot be deleted to preserve financial audit trail.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, invoiceNumber: true },
    });

    if (!existing) {
      throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        `Only draft invoices can be deleted. Invoice ${existing.invoiceNumber} is ${existing.status}. For issued invoices, use cancel.`,
        400,
        'ERR_CANNOT_DELETE_NON_DRAFT'
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return sendSuccess(res, { id, invoiceNumber: existing.invoiceNumber }, `Draft invoice ${existing.invoiceNumber} deleted successfully`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/:id/cancel
 * Cancels an ISSUED invoice that has no recorded payments.
 */
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const cancelledInvoice = await prisma.$transaction(async (tx) => {
      const lockedRows: any[] = await tx.$queryRaw`
        SELECT id, status, "invoiceNumber"
        FROM "invoices"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new AppError('Invoice not found', 404, 'ERR_INVOICE_NOT_FOUND');
      }

      const locked = lockedRows[0];

      if (locked.status === 'CANCELLED') {
        throw new AppError('Invoice is already cancelled', 400, 'ERR_ALREADY_CANCELLED');
      }

      if (locked.status === 'DRAFT') {
        throw new AppError('Draft invoices cannot be cancelled; delete the draft instead', 400, 'ERR_DRAFT_CANNOT_CANCEL');
      }

      const paymentsCount = await tx.payment.count({ where: { invoiceId: id } });
      if (paymentsCount > 0) {
        throw new AppError(
          'Cannot cancel an invoice with recorded payments. Please delete or refund payments first.',
          400,
          'ERR_INVOICE_HAS_PAYMENTS'
        );
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    return sendSuccess(
      res,
      cancelledInvoice,
      `Invoice ${cancelledInvoice.invoiceNumber} has been cancelled`
    );
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/:id/payments
 * Records payment for an issued invoice
 */
router.post(
  '/:id/payments',
  validateRequest({ body: createPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await handleRecordPayment(id, req.body);
      return sendSuccess(res, result, 'Payment recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

export const invoicesRouter = router;
