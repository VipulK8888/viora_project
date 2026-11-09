import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/response';
import { validateRequest } from '../../middlewares/validate';
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

const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(150),
  logoUrl: z.string().optional().nullable(),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  phone: z.string().trim().refine(isValidIndianPhone, {
    message: 'Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210)',
  }),
  email: z.string().email('Invalid email address').max(255),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid GSTIN format (must be 15 alphanumeric characters, e.g. 29ABCDE1234F1Z5)',
  }).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  invoicePrefix: z.string().min(1).max(10).optional(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPass: z.string().optional().nullable(),
  smtpSecure: z.boolean().optional().nullable(),
  smtpFrom: z.string().optional().nullable(),
});

/**
 * GET /api/business
 * Returns active business profile
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const business = await getOrCreateDefaultBusiness();
    return sendSuccess(res, business, 'Business details retrieved successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/business
 * Updates business profile
 */
router.put(
  '/',
  validateRequest({ body: updateBusinessSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await getOrCreateDefaultBusiness();
      const updated = await prisma.business.update({
        where: { id: current.id },
        data: {
          name: req.body.name,
          logoUrl: req.body.logoUrl ?? current.logoUrl,
          address: req.body.address,
          phone: req.body.phone,
          email: req.body.email,
          gstin: req.body.gstin ?? null,
          state: req.body.state !== undefined ? req.body.state : current.state,
          invoicePrefix: req.body.invoicePrefix ?? current.invoicePrefix,
          smtpHost: req.body.smtpHost !== undefined ? req.body.smtpHost : current.smtpHost,
          smtpPort: req.body.smtpPort !== undefined ? req.body.smtpPort : current.smtpPort,
          smtpUser: req.body.smtpUser !== undefined ? req.body.smtpUser : current.smtpUser,
          smtpPass: req.body.smtpPass !== undefined ? req.body.smtpPass : current.smtpPass,
          smtpSecure: req.body.smtpSecure !== undefined ? req.body.smtpSecure : current.smtpSecure,
          smtpFrom: req.body.smtpFrom !== undefined ? req.body.smtpFrom : current.smtpFrom,
        },
      });

      return sendSuccess(res, updated, 'Business profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

export const businessRouter = router;
