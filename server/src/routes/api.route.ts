import { Router } from 'express';
import { healthRouter } from './health.route';
import { businessRouter } from './v1/business.route';
import { customersRouter } from './v1/customers.route';
import { productsRouter } from './v1/products.route';
import { invoicesRouter } from './v1/invoices.route';
import { paymentsRouter } from './v1/payments.route';
import { dashboardRouter } from './v1/dashboard.route';
import { reportsRouter } from './v1/reports.route';
import { remindersRouter } from './v1/reminders.route';

const router = Router();

// Health check endpoint mounted at /health (accessible as /api/health)
router.use('/health', healthRouter);

// Core business endpoints mounted at /api/...
router.use('/business', businessRouter);
router.use('/customers', customersRouter);
router.use('/products', productsRouter);
router.use('/invoices', invoicesRouter);
router.use('/payments', paymentsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportsRouter);
router.use('/reminders', remindersRouter);

// Versioned aliases (/api/v1/...) for backwards compatibility
router.use('/v1/business', businessRouter);
router.use('/v1/customers', customersRouter);
router.use('/v1/products', productsRouter);
router.use('/v1/invoices', invoicesRouter);
router.use('/v1/payments', paymentsRouter);
router.use('/v1/dashboard', dashboardRouter);
router.use('/v1/reports', reportsRouter);
router.use('/v1/reminders', remindersRouter);

export const apiRouter = router;
