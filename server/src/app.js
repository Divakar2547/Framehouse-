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

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ─── Rate limiting ────────────────────────────────────────────────────────────

app.use('/api', globalRateLimiter);

// ─── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: env.NODE_ENV, timestamp: new Date().toISOString() });
});

// Mock S3 upload and view endpoints for local testing/demo
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
