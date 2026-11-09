import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { env } from '../config/env';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'ERR_INTERNAL', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const isAppError = err instanceof AppError;
  const errObj = (typeof err === 'object' && err !== null ? err : {}) as {
    statusCode?: number;
    status?: number | string;
    code?: string;
    message?: string;
    details?: unknown;
  };
  const statusCode = errObj.statusCode || (errObj.status ? Number(errObj.status) : 500);
  const code = errObj.code || `ERR_${statusCode}`;

  // In production, mask unhandled 500 errors so internal database/stack errors are never leaked
  const message =
    env.NODE_ENV === 'production' && !isAppError && statusCode === 500
      ? 'An unexpected internal error occurred'
      : errObj.message || 'Internal Server Error';

  const details = isAppError ? (err as AppError).details : undefined;

  if (env.NODE_ENV !== 'test') {
    const cleanMethod = encodeURIComponent(String(req.method || '')).replace(/[\r\n]/g, '');
    const cleanUrl = encodeURI(String(req.originalUrl || req.url || '')).replace(/[\r\n]/g, '');
    console.error(`[Error] ${cleanMethod} ${cleanUrl}:`, err);
  }

  return sendError(res, message, statusCode, code, details);
}
