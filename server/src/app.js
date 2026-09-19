import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import eventRoutes from './routes/event.routes.js';
import photoRoutes from './routes/photo.routes.js';
import galleryRoutes from './routes/gallery.routes.js';
import publicRoutes from './routes/public.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationRoutes from './routes/notification.routes.js';

import { mockStorage } from './services/s3.service.js';

const app = express();

// Trust reverse proxy in production (Render, Railway, Fly.io, Vercel)
if (env.isProduction) {
  app.set('trust proxy', 1);
}

// ─── Security Headers ──────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: env.isProduction
      ? undefined
      : false, // Relax CSP in development
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────

const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server, health checks)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const hostname = (() => {
        try { return new URL(origin).hostname; } catch { return ''; }
      })();

      const isAllowed =
        configuredOrigins.includes(normalizedOrigin) ||
        hostname.endsWith('.vercel.app') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1';

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}. Configured origins: ${configuredOrigins.join(', ')}`);
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ─── Root & Health check ──────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name: 'Framehouse API',
    status: 'online',
    environment: env.NODE_ENV,
    health: '/health',
    message: 'Framehouse Backend API is running successfully.'
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// Storage upload and view endpoints (used as automatic fallback when AWS S3 is not configured)
app.put('/api/mock-upload/:key(*)', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  mockStorage.set(req.params.key, req.body);
  res.status(200).send('OK');
});

app.get('/api/mock-view/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    let buf = mockStorage.get(key);
    if (!buf) {
      const { getObjectBuffer } = await import('./services/s3.service.js');
      buf = await getObjectBuffer(key);
    }
    if (buf) {
      if (req.query.download === '1') {
        const filename = req.query.filename || 'photo.jpg';
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      }
      res.type('image/jpeg').send(buf);
    } else {
      res.status(404).send('Not found');
    }
  } catch (err) {
    res.status(500).send('Error loading image');
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api', globalRateLimiter);

app.use('/api/public/gallery', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api', photoRoutes);
app.use('/api', galleryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
