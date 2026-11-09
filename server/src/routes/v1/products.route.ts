import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';
import { round2, toDecimal } from '../../utils/money';

const router = Router();

const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200, 'Product name cannot exceed 200 characters'),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
  unit: z.string().min(1, 'Unit is required').max(20).default('PCS'),
  unitPrice: z.coerce
    .number()
    .min(0, 'Unit price cannot be negative')
    .max(100000000, 'Unit price cannot exceed ₹100,000,000'),
  taxRate: z.coerce.number().min(0).max(100, 'Tax rate must be between 0% and 100%').default(0),
  isActive: z.boolean().optional().default(true),
});

const updateProductSchema = createProductSchema.partial();

const productQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  isActive: z.enum(['true', 'false', 'all']).optional().default('all'),
  includeArchived: z.enum(['true', 'false']).optional().default('false'),
});

/**
 * GET /api/products
 * Returns paginated product list with search and filter
 */
router.get(
  '/',
  validateRequest({ query: productQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const { search, page, limit, isActive, includeArchived } = req.query as any;

      const where: any = {
        businessId: business.id,
      };

      if (includeArchived !== 'true') {
        where.isArchived = false;
      }

      if (isActive === 'true') {
        where.isActive = true;
      } else if (isActive === 'false') {
        where.isActive = false;
      }

      if (search && search.trim() !== '') {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { unit: { contains: q, mode: 'insensitive' } },
        ];
      }

      const totalCount = await prisma.product.count({ where });
      const products = await prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(
        res,
        {
          products,
          pagination: {
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
        },
        'Products retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/products/:id
 * Returns single product details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new AppError('Product not found', 404, 'ERR_PRODUCT_NOT_FOUND');
    }

    return sendSuccess(res, product, 'Product retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products
 * Creates a new product catalog item
 */
router.post(
  '/',
  validateRequest({ body: createProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const business = await getOrCreateDefaultBusiness();
      const product = await prisma.product.create({
        data: {
          businessId: business.id,
          name: req.body.name.trim(),
          description: req.body.description ? req.body.description.trim() : null,
          unit: req.body.unit ? req.body.unit.trim().toUpperCase() : 'PCS',
          unitPrice: round2(toDecimal(req.body.unitPrice)),
          taxRate: toDecimal(req.body.taxRate),
          isActive: req.body.isActive ?? true,
        },
      });

      return sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/products/:id
 * Updates product details
 */
router.put(
  '/:id',
  validateRequest({ body: updateProductSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError('Product not found', 404, 'ERR_PRODUCT_NOT_FOUND');
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: req.body.name !== undefined ? req.body.name.trim() : undefined,
          description: req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : null) : undefined,
          unit: req.body.unit !== undefined ? req.body.unit.trim().toUpperCase() : undefined,
          unitPrice: req.body.unitPrice !== undefined ? round2(toDecimal(req.body.unitPrice)) : undefined,
          taxRate: req.body.taxRate !== undefined ? toDecimal(req.body.taxRate) : undefined,
          isActive: req.body.isActive !== undefined ? req.body.isActive : undefined,
        },
      });

      return sendSuccess(res, updated, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/products/:id
 * Soft deletes/archives product if referenced in past invoices
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      throw new AppError('Product not found', 404, 'ERR_PRODUCT_NOT_FOUND');
    }

    if (existing._count.items > 0) {
      // Historical references exist - archive product
      const archived = await prisma.product.update({
        where: { id },
        data: { isArchived: true, isActive: false },
      });
      return sendSuccess(
        res,
        archived,
        'Product has historical invoice items and was archived successfully'
      );
    } else {
      // Safe to delete permanently
      await prisma.product.delete({ where: { id } });
      return sendSuccess(res, { id, deleted: true }, 'Product removed successfully');
    }
  } catch (error) {
    next(error);
  }
});

export const productsRouter = router;
