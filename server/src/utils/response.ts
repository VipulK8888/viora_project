import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  timestamp: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const payload: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): Response {
  const payload: ApiResponse = {
    success: false,
    error: {
      message,
      code: code || `ERR_${statusCode}`,
      details,
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}
