import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReminderService } from '../../services/reminder.service';
import { getOrCreateDefaultBusiness } from '../../utils/businessHelper';

const router = Router();

// GET /api/reminders/queue
router.get('/queue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ReminderService.getReminderQueue();
    res.json({
      success: true,
      message: 'Reminder queue calculated successfully',
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reminders/logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const logs = await ReminderService.getReminderLogs(limit);
    res.json({
      success: true,
      message: 'Reminder audit logs retrieved successfully',
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/run (Automated Sweep)
router.post('/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReminderService.runAutomatedCadenceSweep();
    res.json({
      success: true,
      message: `Automated cadence sweep executed. ${result.dueProcessed} reminders dispatched.`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/invoices/:id/whatsapp
router.post('/invoices/:id/whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReminderService.sendWhatsAppReminder(req.params.id);
    res.json({
      success: true,
      message: 'WhatsApp reminder recorded and prepared successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/invoices/:id/email
router.post('/invoices/:id/email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReminderService.sendEmailReminder(req.params.id);
    res.json({
      success: true,
      message: 'Email reminder dispatched successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/invoices/:id/both
router.post('/invoices/:id/both', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReminderService.sendBothReminders(req.params.id);
    res.json({
      success: true,
      message: 'Automated Email and WhatsApp reminders dispatched successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/test
const testSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  amount: z.number().min(1).optional(),
  customerName: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = testSchema.parse(req.body);
    const result = await ReminderService.testReminderSimulation(validated);
    res.json({
      success: true,
      message: 'Test reminder generated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/smtp-test
router.post('/smtp-test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const business = await getOrCreateDefaultBusiness();
    const host = req.body.smtpHost || business.smtpHost || process.env.SMTP_HOST;
    const port = Number(req.body.smtpPort || business.smtpPort || process.env.SMTP_PORT) || 587;
    const user = req.body.smtpUser || business.smtpUser || process.env.SMTP_USER;
    const pass = req.body.smtpPass || business.smtpPass || process.env.SMTP_PASS;
    const secure = Boolean(req.body.smtpSecure ?? business.smtpSecure);
    const testEmail = req.body.testEmail || business.email;

    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'A destination email address is required to send the test email.',
      });
    }

    if (!user || !pass) {
      // If custom credentials are not provided, dispatch via Ethereal sandbox so the user gets an instant preview URL!
      const simulation = await ReminderService.testReminderSimulation({
        amount: 25000,
        email: testEmail,
        customerName: 'Test Recipient',
        invoiceNumber: 'INV-TEST-SMTP',
      });
      return res.json({
        success: true,
        message: 'No custom SMTP credentials configured yet. Test message was dispatched to the online Ethereal Sandbox! Click the link below to view the delivered email online.',
        data: {
          success: true,
          isLiveSmtp: false,
          provider: 'ethereal.email (Sandbox)',
          previewUrl: simulation.email?.previewUrl,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const result = await ReminderService.testSmtpConnection({
      smtpHost: host || 'smtp.gmail.com',
      smtpPort: port,
      smtpUser: user,
      smtpPass: pass,
      smtpSecure: secure,
      testEmail,
    });

    res.json({
      success: true,
      message: `Test email successfully delivered to ${testEmail} via ${result.provider}!`,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: `SMTP connection failed: ${err.message}`,
      error: {
        code: 'ERR_SMTP_VERIFICATION',
        details: err.message,
        hint: err.message?.includes('Username and Password not accepted')
          ? 'For Gmail: Enable 2-Step Verification on your Google Account, then generate a 16-character App Password at https://myaccount.google.com/apppasswords and use that as the password.'
          : 'Check your SMTP host, port, and security settings.',
      },
    });
  }
});

// PATCH /api/reminders/config
const configSchema = z.object({
  highTierMinAmount: z.number().min(0).optional(),
  highTierDaysGap: z.number().int().min(1).max(90).optional(),
  midTierMinAmount: z.number().min(0).optional(),
  midTierDaysGap: z.number().int().min(1).max(90).optional(),
  lowTierDaysGap: z.number().int().min(1).max(90).optional(),
  autoReminderEnabled: z.boolean().optional(),
});

router.patch('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = configSchema.parse(req.body);
    const updated = await ReminderService.updateCadenceConfig(validated);
    res.json({
      success: true,
      message: 'Reminder cadence configuration updated successfully',
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export const remindersRouter = router;

