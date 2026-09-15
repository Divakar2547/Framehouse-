import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.isDevelopment ? 5000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isDevelopment,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isDevelopment,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
});

export const pinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment ? 100 : env.PIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => env.isDevelopment,
  message: { success: false, message: 'Too many incorrect PIN attempts. Please try again in 15 minutes.' },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.isDevelopment ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isDevelopment,
  message: { success: false, message: 'Upload rate limit exceeded.' },
});

export const downloadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.isDevelopment ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isDevelopment,
  message: { success: false, message: 'Download rate limit exceeded.' },
});
