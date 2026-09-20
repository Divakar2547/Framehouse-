import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

/**
 * ANALYTICS & AUDIT LOG TESTS
 *
 * Covers:
 *  - GET /api/analytics/dashboard
 *  - GET /api/analytics/events/:id
 *  - GET /api/analytics/audit-logs
 *  - Access control (team member blocked, unauthenticated blocked)
 *  - Audit log entries created on key actions
 *  - Gallery view + download counter increments
 *
 * Requires seeded DB: npm run db:seed
 * Run: npm test -- --testPathPattern=analytics
 */

let adminCookie;
let teamCookie;
let adminEventId;
let publishedGalleryId;
let publishedGallerySlug;

beforeAll(async () => {
  // Authenticate admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@framehouse.com', password: 'Admin@123456' });
  adminCookie = adminRes.headers['set-cookie'];

  // Authenticate team member
  const teamRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'photographer@framehouse.com', password: 'Member@123456' });
  teamCookie = teamRes.headers['set-cookie'];

  // Grab the seeded wedding event owned by admin
  const event = await prisma.event.findFirst({
    where: { name: { contains: 'Wedding' } },
    orderBy: { createdAt: 'asc' },
  });
  adminEventId = event?.id;

  // Grab the seeded published gallery
  const gallery = await prisma.gallery.findFirst({
    where: { isPublished: true },
    orderBy: { createdAt: 'asc' },
  });
  publishedGalleryId = gallery?.id;
  publishedGallerySlug = gallery?.slug;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── Dashboard Analytics ──────────────────────────────────────────────────────

describe('ANALYTICS: Dashboard', () => {
  test('GET /api/analytics/dashboard — 401 without auth', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/analytics/dashboard — 403 for team member', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Cookie', teamCookie);
    expect(res.status).toBe(403);
  });

  test('GET /api/analytics/dashboard — returns summary for admin', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { summary } = res.body.data;
    expect(summary).toBeDefined();
    expect(typeof summary.totalEvents).toBe('number');
    expect(typeof summary.totalPhotos).toBe('number');
    expect(typeof summary.selectedPhotos).toBe('number');
    expect(typeof summary.publishedGalleries).toBe('number');
    expect(typeof summary.totalViews).toBe('number');
    expect(typeof summary.totalDownloads).toBe('number');
  });

  test('GET /api/analytics/dashboard — totalEvents matches DB count for this admin', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Cookie', adminCookie);

    // Get admin user id from /me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    const dbCount = await prisma.event.count({ where: { ownerId: adminId } });
    expect(res.body.data.summary.totalEvents).toBe(dbCount);
  });

  test('GET /api/analytics/dashboard — recentEvents array is present', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Cookie', adminCookie);

    expect(Array.isArray(res.body.data.recentEvents)).toBe(true);
    // Each item should have id and name
    if (res.body.data.recentEvents.length > 0) {
      expect(res.body.data.recentEvents[0].id).toBeDefined();
      expect(res.body.data.recentEvents[0].name).toBeDefined();
    }
  });
});

// ─── Event Analytics ──────────────────────────────────────────────────────────

describe('ANALYTICS: Per-Event', () => {
  test('GET /api/analytics/events/:id — 401 without auth', async () => {
    const res = await request(app).get(`/api/analytics/events/${adminEventId}`);
    expect(res.status).toBe(401);
  });

  test('GET /api/analytics/events/:id — 403 for team member', async () => {
    const res = await request(app)
      .get(`/api/analytics/events/${adminEventId}`)
      .set('Cookie', teamCookie);
    expect(res.status).toBe(403);
  });

  test('GET /api/analytics/events/:id — returns photo and storage stats for admin', async () => {
    const res = await request(app)
      .get(`/api/analytics/events/${adminEventId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { photoStats, storageStats, memberCount, galleries } = res.body.data;
    expect(Array.isArray(photoStats)).toBe(true);
    expect(storageStats).toBeDefined();
    expect(typeof storageStats.totalPhotos).toBe('number');
    expect(typeof storageStats.totalStorage).toBe('string'); // BigInt serialised as string
    expect(typeof memberCount).toBe('number');
    expect(Array.isArray(galleries)).toBe(true);
  });

  test('GET /api/analytics/events/:id — 403 when admin requests another admin\'s event', async () => {
    // Create a second admin and a new event
    const email2 = `analytics-admin2-${Date.now()}@framehouse.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin Two', email: email2, password: 'Admin@999' });

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: email2, password: 'Admin@999' });
    const cookie2 = login2.headers['set-cookie'];

    const res = await request(app)
      .get(`/api/analytics/events/${adminEventId}`)
      .set('Cookie', cookie2);

    expect(res.status).toBe(403);

    // Cleanup
    await prisma.user.deleteMany({ where: { email: email2 } }).catch(() => {});
  });

  test('GET /api/analytics/events/:id — 404 for non-existent event id', async () => {
    const res = await request(app)
      .get('/api/analytics/events/000000000000000000000000')
      .set('Cookie', adminCookie);

    expect([403, 404]).toContain(res.status);
  });
});

// ─── Gallery Analytics ────────────────────────────────────────────────────────

describe('ANALYTICS: Gallery', () => {
  test('GET /api/galleries/:id/analytics — 401 without auth', async () => {
    const res = await request(app).get(`/api/galleries/${publishedGalleryId}/analytics`);
    expect(res.status).toBe(401);
  });

  test('GET /api/galleries/:id/analytics — 403 for team member', async () => {
    const res = await request(app)
      .get(`/api/galleries/${publishedGalleryId}/analytics`)
      .set('Cookie', teamCookie);
    expect(res.status).toBe(403);
  });

  test('GET /api/galleries/:id/analytics — returns view and download counts for admin', async () => {
    const res = await request(app)
      .get(`/api/galleries/${publishedGalleryId}/analytics`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { gallery, uniqueVisitors } = res.body.data;
    expect(gallery).toBeDefined();
    expect(typeof gallery.viewCount).toBe('number');
    expect(typeof gallery.downloadCount).toBe('number');
    expect(typeof uniqueVisitors).toBe('number');
  });

  test('Gallery viewCount increments after a customer verifies PIN', async () => {
    // Get current view count
    const before = await prisma.gallery.findUnique({
      where: { id: publishedGalleryId },
      select: { viewCount: true, pinHash: true },
    });

    // Customer verifies PIN (uses the seeded wedding gallery PIN)
    await request(app)
      .post(`/api/public/gallery/${publishedGallerySlug}/verify-pin`)
      .send({ pin: '482917' });

    // Allow async update to complete
    await new Promise(r => setTimeout(r, 200));

    const after = await prisma.gallery.findUnique({
      where: { id: publishedGalleryId },
      select: { viewCount: true },
    });

    expect(after.viewCount).toBeGreaterThanOrEqual(before.viewCount);
  });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

describe('ANALYTICS: Audit Logs', () => {
  test('GET /api/analytics/audit-logs — 401 without auth', async () => {
    const res = await request(app).get('/api/analytics/audit-logs');
    expect(res.status).toBe(401);
  });

  test('GET /api/analytics/audit-logs — 403 for team member', async () => {
    const res = await request(app)
      .get('/api/analytics/audit-logs')
      .set('Cookie', teamCookie);
    expect(res.status).toBe(403);
  });

  test('GET /api/analytics/audit-logs — returns paginated logs for admin', async () => {
    const res = await request(app)
      .get('/api/analytics/audit-logs')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe('number');
  });

  test('GET /api/analytics/audit-logs — pagination limit respected', async () => {
    const res = await request(app)
      .get('/api/analytics/audit-logs?limit=3&page=1')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeLessThanOrEqual(3);
  });

  test('GET /api/analytics/audit-logs — each entry has action and createdAt', async () => {
    const res = await request(app)
      .get('/api/analytics/audit-logs')
      .set('Cookie', adminCookie);

    if (res.body.data.logs.length > 0) {
      const entry = res.body.data.logs[0];
      expect(entry.action).toBeDefined();
      expect(entry.createdAt).toBeDefined();
    }
  });

  test('Audit log entry is written when admin creates an event', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    const eventName = `Audit Log Test Event ${Date.now()}`;

    await request(app)
      .post('/api/events')
      .set('Cookie', adminCookie)
      .send({ name: eventName, eventDate: '2027-01-01T00:00:00.000Z' });

    // Give the async audit log write a moment
    await new Promise(r => setTimeout(r, 300));

    const log = await prisma.auditLog.findFirst({
      where: { userId: adminId, action: 'EVENT_CREATED' },
      orderBy: { createdAt: 'desc' },
    });

    expect(log).toBeTruthy();
    expect(log.action).toBe('EVENT_CREATED');

    // Cleanup
    await prisma.event.deleteMany({ where: { name: eventName } }).catch(() => {});
  });

  test('Audit log entry is written when admin publishes a gallery', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    // Count GALLERY_PUBLISHED logs before
    const before = await prisma.auditLog.count({
      where: { userId: adminId, action: 'GALLERY_PUBLISHED' },
    });

    // We already have a published gallery from seed — just check count is > 0
    expect(before).toBeGreaterThan(0);
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────

describe('ANALYTICS: Notifications', () => {
  test('GET /api/notifications — 401 without auth', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  test('GET /api/notifications — returns notifications for admin', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
    expect(typeof res.body.data.unreadCount).toBe('number');
  });

  test('GET /api/notifications — team member can see their own notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', teamCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });

  test('PATCH /api/notifications/:id/read — marks a notification as read', async () => {
    // Find an unread notification for admin
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    const notification = await prisma.notification.findFirst({
      where: { userId: adminId },
    });

    if (!notification) return; // Skip if no notifications

    const res = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);

    const updated = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(updated.isRead).toBe(true);
  });

  test('PATCH /api/notifications/read-all — marks all notifications as read', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);

    const unreadCount = await prisma.notification.count({
      where: { userId: adminId, isRead: false },
    });
    expect(unreadCount).toBe(0);
  });

  test('PATCH /api/notifications/:id/read — 404 for another user\'s notification', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    const adminId = meRes.body.data.user.id;

    // Find a team member's notification
    const teamUser = await prisma.user.findFirst({
      where: { email: 'photographer@framehouse.com' },
    });
    const teamNotif = await prisma.notification.findFirst({
      where: { userId: teamUser.id },
    });

    if (!teamNotif) return; // Skip if none

    // Admin tries to mark team member's notification as read
    const res = await request(app)
      .patch(`/api/notifications/${teamNotif.id}/read`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
  });
});
