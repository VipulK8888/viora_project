import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';

const router = Router();

const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+91')) return cleaned.slice(3);
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
  return cleaned;
};

const isValidIndianPhone = (phone: string): boolean => {
  const norm = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(norm);
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(150, 'Customer name cannot exceed 150 characters'),
  phone: z.string().trim().refine(isValidIndianPhone, {
    message: 'Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210)',
  }),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  billingAddress: z.string().min(3, 'Billing address must be at least 3 characters').max(500, 'Billing address cannot exceed 500 characters'),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 29ABCDE1234F1Z5)',
  }).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name must be at least 2 characters').max(150, 'Customer name cannot exceed 150 characters').optional(),
  phone: z.string().trim().refine(isValidIndianPhone, {
    message: 'Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210)',
  }).optional(),
  email: z.string().email('Invalid email address').max(255).optional().nullable(),
  billingAddress: z.string().min(3, 'Billing address must be at least 3 characters').max(500, 'Billing address cannot exceed 500 characters').optional(),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 29ABCDE1234F1Z5)',
  }).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
});

const customerQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

/**
 * GET /api/customers
 * Returns paginated customer list with search filter
 */
router.get(
  '/',
  validateRequest({ query: customerQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { search, page, limit, includeArchived } = req.query as unknown as {
        search?: string;
        page: number;
        limit: number;
        includeArchived?: string;
      };

      const where: Prisma.CustomerWhereInput = {
        businessId: business.id,
      };

      if (includeArchived !== 'true') {
        where.isArchived = false;
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { gstin: { contains: q, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.customer.count({ where });
      const customers = await prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { invoices: true },
          },
        },
      });

      return sendSuccess(
        res,
        {
          customers,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Customers retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/:id
 * Returns single customer with recent invoices
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          take: 10,
          orderBy: { invoiceDate: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            dueDate: true,
            status: true,
            grandTotal: true,
          },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
    }

    return sendSuccess(res, customer, 'Customer retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Creates a new customer
 */
router.post(
  '/',
  validateRequest({ body: createCustomerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const rawPhone = req.body.phone.trim();
      const normalizedPhone = normalizePhone(rawPhone);
      const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
      const gstin = req.body.gstin ? req.body.gstin.trim().toUpperCase() : null;

      // Check duplicate phone
      const duplicatePhone = await prisma.customer.findFirst({
        where: {
          businessId: business.id,
          isArchived: false,
          phone: { in: [rawPhone, normalizedPhone, `+91 ${normalizedPhone}`, `+91${normalizedPhone}`] },
        },
      });
      if (duplicatePhone) {
        throw new AppError('A customer with this phone number already exists', 400, 'ERR_CUSTOMER_EXISTS');
      }

      // Check duplicate email
      if (email) {
        const duplicateEmail = await prisma.customer.findFirst({
          where: {
            businessId: business.id,
            isArchived: false,
            email: { equals: email, mode: 'insensitive' },
          },
        });
        if (duplicateEmail) {
          throw new AppError('A customer with this email address already exists', 400, 'ERR_CUSTOMER_EXISTS');
        }
      }

      const customer = await prisma.customer.create({
        data: {
          businessId: business.id,
          name: req.body.name.trim(),
          phone: rawPhone,
          email,
          billingAddress: req.body.billingAddress.trim(),
          gstin,
          state: req.body.state ? req.body.state.trim() : 'Karnataka',
        },
      });

      return sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customers/:id
 * Updates customer details
 */
router.put(
  '/:id',
  validateRequest({ body: updateCustomerSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
      }

      const rawPhone = req.body.phone !== undefined ? req.body.phone.trim() : undefined;
      const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : undefined;
      const email = req.body.email !== undefined ? (req.body.email ? req.body.email.trim().toLowerCase() : null) : undefined;
      const gstin = req.body.gstin !== undefined ? (req.body.gstin ? req.body.gstin.trim().toUpperCase() : null) : undefined;

      if (normalizedPhone) {
        const duplicatePhone = await prisma.customer.findFirst({
          where: {
            businessId: existing.businessId,
            id: { not: id },
            isArchived: false,
            phone: { in: [rawPhone!, normalizedPhone, `+91 ${normalizedPhone}`, `+91${normalizedPhone}`] },
          },
        });
        if (duplicatePhone) {
          throw new AppError('Another customer with this phone number already exists', 400, 'ERR_CUSTOMER_EXISTS');
        }
      }

      if (email) {
        const duplicateEmail = await prisma.customer.findFirst({
          where: {
            businessId: existing.businessId,
            id: { not: id },
            isArchived: false,
            email: { equals: email, mode: 'insensitive' },
          },
        });
        if (duplicateEmail) {
          throw new AppError('Another customer with this email address already exists', 400, 'ERR_CUSTOMER_EXISTS');
        }
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: req.body.name !== undefined ? req.body.name.trim() : undefined,
          phone: rawPhone,
          email,
          billingAddress: req.body.billingAddress !== undefined ? req.body.billingAddress.trim() : undefined,
          gstin,
          state: req.body.state !== undefined ? (req.body.state ? req.body.state.trim() : null) : undefined,
        },
      });

      return sendSuccess(res, updated, 'Customer updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Soft deletes/archives customer to preserve historical invoice records
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!existing) {
      throw new AppError('Customer not found', 404, 'ERR_CUSTOMER_NOT_FOUND');
    }

    if (existing._count.invoices > 0) {
      // Historical references exist - soft delete/archive
      const archived = await prisma.customer.update({
        where: { id },
        data: { isArchived: true },
      });
      return sendSuccess(
        res,
        archived,
        'Customer has historical invoices and was archived successfully'
      );
    } else {
      // No historical invoices - permanent removal is safe
      await prisma.customer.delete({ where: { id } });
      return sendSuccess(res, { id, deleted: true }, 'Customer removed successfully');
    }
  } catch (error) {
    next(error);
  }
});

export const customersRouter = router;
