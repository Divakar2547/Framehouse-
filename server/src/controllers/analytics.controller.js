import { sendSuccess, sendError } from '../utils/response.js';
import prisma from '../config/prisma.js';

// ─── Admin dashboard analytics ────────────────────────────────────────────────

export async function getDashboardAnalytics(req, res, next) {
  try {
    const user = req.user;

    const [
      totalEvents,
      totalPhotos,
      selectedPhotos,
      publishedGalleries,
      totalViews,
      totalDownloads,
      recentEvents,
    ] = await Promise.all([
      prisma.event.count({ where: { ownerId: user.id } }),
      prisma.photo.count({
        where: { event: { ownerId: user.id }, status: { not: 'DELETED' } },
      }),
      prisma.photo.count({
        where: { event: { ownerId: user.id }, isSelected: true, status: 'READY' },
      }),
      prisma.gallery.count({
        where: { event: { ownerId: user.id }, isPublished: true },
      }),
      prisma.gallery.aggregate({
        where: { event: { ownerId: user.id } },
        _sum: { viewCount: true },
      }),
      prisma.gallery.aggregate({
        where: { event: { ownerId: user.id } },
        _sum: { downloadCount: true },
      }),
      prisma.event.findMany({
        where: { ownerId: user.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, status: true, eventDate: true,
          _count: { select: { photos: true, members: true } },
        },
      }),
    ]);

    // Upload activity for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const uploadActivity = await prisma.photo.groupBy({
      by: ['createdAt'],
      where: {
        event: { ownerId: user.id },
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'DELETED' },
      },
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    sendSuccess(res, {
      summary: {
        totalEvents,
        totalPhotos,
        selectedPhotos,
        publishedGalleries,
        totalViews: totalViews._sum.viewCount ?? 0,
        totalDownloads: totalDownloads._sum.downloadCount ?? 0,
      },
      recentEvents,
      uploadActivity,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Event analytics ──────────────────────────────────────────────────────────

export async function getEventAnalytics(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
    if (!event || event.ownerId !== user.id) {
      sendError(res, 'Event not found or access denied', 403);
      return;
    }

    const [photoStats, storageStats, memberStats, galleryStats] = await Promise.all([
      prisma.photo.groupBy({
        by: ['status'],
        where: { eventId },
        _count: true,
      }),
      prisma.photo.aggregate({
        where: { eventId, status: { not: 'DELETED' } },
        _sum: { fileSize: true },
        _count: true,
      }),
      prisma.eventMember.count({ where: { eventId } }),
      prisma.gallery.findMany({
        where: { eventId },
        select: {
          id: true, title: true, slug: true, isPublished: true,
          viewCount: true, downloadCount: true, publishedAt: true,
          _count: { select: { photos: true } },
        },
      }),
    ]);

    const uploaderStats = await prisma.photo.groupBy({
      by: ['uploadedById'],
      where: { eventId, status: { not: 'DELETED' } },
      _count: true,
      orderBy: { _count: { uploadedById: 'desc' } },
    });

    sendSuccess(res, {
      photoStats,
      storageStats: {
        totalPhotos: storageStats._count,
        totalStorage: storageStats._sum.fileSize?.toString() ?? '0',
      },
      memberCount: memberStats,
      galleries: galleryStats,
      uploaderBreakdown: uploaderStats,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Audit logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(req, res, next) {
  try {
    const user = req.user;
    const { page = '1', limit = '20', eventId, action } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const where = { userId: user.id };
    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
      if (!event || event.ownerId !== user.id) {
        sendError(res, 'Access denied', 403);
        return;
      }
      where.eventId = eventId;
    }
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    sendSuccess(res, { logs }, undefined, 200, {
      page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
}
