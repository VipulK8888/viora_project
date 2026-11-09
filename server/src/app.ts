import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes/api.route';
import { errorHandler, AppError } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration supporting single or comma-separated origins
  const allowedOrigins = [
    ...env.CLIENT_URL.split(',').map((u) => u.trim().replace(/\/$/, '')),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman, or server-to-server)
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalized) || env.NODE_ENV === 'development') {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Request logger
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root welcome / status endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Viora Bills API',
      version: '0.1.0',
      status: 'active',
      phase: 'Phase 1 - Project Foundation',
      documentation: '/api/health',
    });
  });

  // Mount API router at /api
  app.use('/api', apiRouter);

  // 404 Not Found handler
  app.use((req: Request, _res: Response, next) => {
    next(new AppError(`Cannot ${req.method} ${req.path}`, 404, 'ERR_NOT_FOUND'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
