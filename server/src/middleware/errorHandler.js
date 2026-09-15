import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function globalErrorHandler(err, req, res, _next) {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // Known operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
    });
    return;
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    res.status(404).json({
      success: false,
      message: 'Record not found.',
    });
    return;
  }

  // Multer file size error
  if (err.message === 'File too large') {
    res.status(413).json({
      success: false,
      message: 'File size exceeds the maximum allowed limit.',
    });
    return;
  }

  // Unknown errors — hide details in production
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.',
    ...(env.isDevelopment && { error: err.message, stack: err.stack }),
  });
}
