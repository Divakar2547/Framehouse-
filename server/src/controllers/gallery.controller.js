import bcrypt from 'bcryptjs';
import { sendSuccess, sendError } from '../utils/response.js';
import { createAuditLog } from '../utils/auditLog.js';
import { generateSlug } from '../utils/crypto.js';
import { generateViewPresignedUrl } from '../services/s3.service.js';
import prisma from '../config/prisma.js';

// ─── Assert admin owns the event ──────────────────────────────────────────────

async function assertAdminOwnsEvent(eventId, userId) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  return !!event && event.ownerId === userId;
}

async function assertAdminOwnsGallery(galleryId, userId) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    include: { event: { select: { ownerId: true } } },
  });
  return !!gallery && gallery.event.ownerId === userId;
}

// ─── Create gallery ───────────────────────────────────────────────────────────

export async function createGallery(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;
    const data = req.body;

    if (!(await assertAdminOwnsEvent(eventId, user.id))) {
      sendError(res, 'Event not found or access denied', 403);
      return;
    }

    const pinHash = await bcrypt.hash(data.pin, 12);
    const slug = generateSlug(data.title);

    const gallery = await prisma.gallery.create({
      data: {
        eventId,
        title: data.title,
        description: data.description,
        slug,
        pinHash,
        allowDownloads: data.allowDownloads ?? false,
        showWatermark: data.showWatermark ?? false,
        watermarkText: data.watermarkText,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        status: 'DRAFT',
        isPublished: false,
      },
    });

    await createAuditLog({
      userId: user.id,
      eventId,
      action: 'GALLERY_CREATED',
      details: { galleryTitle: gallery.title, slug: gallery.slug },
      ipAddress: req.ip,
    });

    const { pinHash: _, ...safeGallery } = gallery;
    sendSuccess(res, { gallery: safeGallery }, 'Gallery created', 201);
  } catch (err) {
    next(err);
  }
}

// ─── List galleries for an event ─────────────────────────────────────────────

export async function listGalleries(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;

    if (!(await assertAdminOwnsEvent(eventId, user.id))) {
      sendError(res, 'Event not found or access denied', 403);
      return;
    }

    const galleries = await prisma.gallery.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { photos: true } },
      },
    });

    sendSuccess(res, { galleries });
  } catch (err) {
    next(err);
  }
}

// ─── Get gallery (admin) ──────────────────────────────────────────────────────

export async function getGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, name: true, ownerId: true } },
        photos: {
          include: {
            photo: {
              select: {
                id: true, filename: true, originalFilename: true,
                storageKey: true, thumbnailStorageKey: true, galleryStorageKey: true,
                width: true, height: true, status: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { photos: true } },
      },
    });

    if (!gallery) {
      sendError(res, 'Gallery not found', 404);
      return;
    }
    if (gallery.event.ownerId !== user.id) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const photosWithUrls = await Promise.all(
      gallery.photos.map(async (gp) => {
        const key = gp.photo.thumbnailStorageKey || gp.photo.galleryStorageKey || gp.photo.storageKey;
        const thumbnailUrl = key ? await generateViewPresignedUrl(key, 3600) : null;
        const galleryUrl = gp.photo.galleryStorageKey ? await generateViewPresignedUrl(gp.photo.galleryStorageKey, 3600) : thumbnailUrl;
        return {
          ...gp,
          photo: {
            ...gp.photo,
            thumbnailUrl,
            galleryUrl,
          },
        };
      })
    );

    // Never return the PIN hash
    const { pinHash: _, ...safeGallery } = gallery;
    sendSuccess(res, { gallery: { ...safeGallery, photos: photosWithUrls } });
  } catch (err) {
    next(err);
  }
}

// ─── Update gallery ───────────────────────────────────────────────────────────

export async function updateGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;
    const data = req.body;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    const updated = await prisma.gallery.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.allowDownloads !== undefined && { allowDownloads: data.allowDownloads }),
        ...(data.showWatermark !== undefined && { showWatermark: data.showWatermark }),
        ...(data.watermarkText !== undefined && { watermarkText: data.watermarkText }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'GALLERY_UPDATED',
      details: { galleryId: id, changes: data },
      ipAddress: req.ip,
    });

    const { pinHash: _, ...safeGallery } = updated;
    sendSuccess(res, { gallery: safeGallery });
  } catch (err) {
    next(err);
  }
}

// ─── Change PIN ────────────────────────────────────────────────────────────────

export async function changePin(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { pin } = req.body;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    const pinHash = await bcrypt.hash(pin, 12);
    await prisma.gallery.update({ where: { id }, data: { pinHash } });

    // Invalidate all existing sessions for this gallery
    await prisma.galleryAccess.deleteMany({ where: { galleryId: id } });

    await createAuditLog({
      userId: user.id,
      action: 'GALLERY_PIN_CHANGED',
      details: { galleryId: id },
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Gallery PIN updated. All existing sessions have been revoked.');
  } catch (err) {
    next(err);
  }
}

// ─── Add photos to gallery ────────────────────────────────────────────────────

export async function addPhotosToGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { photoIds } = req.body;

    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: { event: { select: { ownerId: true, id: true } } },
    });
    if (!gallery || gallery.event.ownerId !== user.id) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    // Validate photos belong to the event
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, eventId: gallery.event.id, status: 'READY' },
      select: { id: true },
    });

    if (photos.length === 0) {
      sendError(res, 'No valid photos found', 400);
      return;
    }

    // Get current max sort order
    const maxOrder = await prisma.galleryPhoto.aggregate({
      where: { galleryId: id },
      _max: { sortOrder: true },
    });
    const startOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    // Upsert gallery photos
    await prisma.$transaction(
      photos.map((photo, index) =>
        prisma.galleryPhoto.upsert({
          where: { galleryId_photoId: { galleryId: id, photoId: photo.id } },
          create: { galleryId: id, photoId: photo.id, sortOrder: startOrder + index },
          update: {},
        })
      )
    );

    sendSuccess(res, { added: photos.length }, `${photos.length} photos added to gallery`);
  } catch (err) {
    next(err);
  }
}

// ─── Remove photo from gallery ────────────────────────────────────────────────

export async function removePhotoFromGallery(req, res, next) {
  try {
    const user = req.user;
    const { id, photoId } = req.params;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    await prisma.galleryPhoto.deleteMany({ where: { galleryId: id, photoId } });
    sendSuccess(res, null, 'Photo removed from gallery');
  } catch (err) {
    next(err);
  }
}

// ─── Reorder gallery photos ───────────────────────────────────────────────────

export async function reorderGalleryPhotos(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;
    const { photoOrders } = req.body;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    await prisma.$transaction(
      photoOrders.map(({ galleryPhotoId, sortOrder }) =>
        prisma.galleryPhoto.update({
          where: { id: galleryPhotoId },
          data: { sortOrder },
        })
      )
    );

    sendSuccess(res, null, 'Photos reordered');
  } catch (err) {
    next(err);
  }
}

// ─── Publish gallery ──────────────────────────────────────────────────────────

export async function publishGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: {
        event: { select: { ownerId: true, name: true } },
        _count: { select: { photos: true } },
      },
    });
    if (!gallery || gallery.event.ownerId !== user.id) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }
    if (gallery._count.photos === 0) {
      sendError(res, 'Cannot publish a gallery with no photos', 400);
      return;
    }

    const updated = await prisma.gallery.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date(), status: 'PUBLISHED' },
    });

    await createAuditLog({
      userId: user.id,
      eventId: gallery.eventId,
      action: 'GALLERY_PUBLISHED',
      details: { galleryTitle: gallery.title, slug: gallery.slug },
      ipAddress: req.ip,
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Gallery Published',
        message: `Gallery "${gallery.title}" for "${gallery.event.name}" is now live.`,
        type: 'gallery',
      },
    });

    const { pinHash: _, ...safeGallery } = updated;
    // CLIENT_URL may be a comma-separated list (CORS origins); use only the first entry
    const clientOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    sendSuccess(res, { gallery: safeGallery, shareUrl: `${clientOrigin}/gallery/${gallery.slug}` }, 'Gallery published');
  } catch (err) {
    next(err);
  }
}

// ─── Unpublish gallery ────────────────────────────────────────────────────────

export async function unpublishGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: { event: { select: { ownerId: true } } },
    });
    if (!gallery || gallery.event.ownerId !== user.id) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    const updated = await prisma.gallery.update({
      where: { id },
      data: { isPublished: false, status: 'UNPUBLISHED' },
    });

    // Revoke all active gallery sessions
    await prisma.galleryAccess.deleteMany({ where: { galleryId: id } });

    await createAuditLog({
      userId: user.id,
      eventId: gallery.eventId,
      action: 'GALLERY_UNPUBLISHED',
      details: { galleryId: id },
      ipAddress: req.ip,
    });

    const { pinHash: _, ...safeGallery } = updated;
    sendSuccess(res, { gallery: safeGallery }, 'Gallery unpublished');
  } catch (err) {
    next(err);
  }
}

// ─── Gallery analytics (admin) ────────────────────────────────────────────────

export async function getGalleryAnalytics(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    const [gallery, views, downloads, topPhotos] = await Promise.all([
      prisma.gallery.findUnique({
        where: { id },
        select: { id: true, title: true, viewCount: true, downloadCount: true, publishedAt: true, isPublished: true },
      }),
      prisma.galleryView.groupBy({
        by: ['sessionId'],
        where: { galleryId: id },
        _count: true,
      }),
      prisma.photoDownload.groupBy({
        by: ['photoId'],
        where: { galleryId: id },
        _count: true,
        orderBy: { _count: { photoId: 'desc' } },
        take: 10,
      }),
      prisma.galleryView.findMany({
        where: { galleryId: id },
        orderBy: { viewedAt: 'desc' },
        take: 1,
        select: { viewedAt: true },
      }),
    ]);

    const uniqueSessionCount = views.length;
    const recentViews = await prisma.galleryView.count({
      where: { galleryId: id, viewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    sendSuccess(res, {
      gallery,
      uniqueVisitors: uniqueSessionCount,
      recentViews,
      topDownloadedPhotos: downloads,
      lastAccessedAt: topPhotos[0]?.viewedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Delete gallery ───────────────────────────────────────────────────────────

export async function deleteGallery(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!(await assertAdminOwnsGallery(id, user.id))) {
      sendError(res, 'Gallery not found or access denied', 403);
      return;
    }

    await prisma.gallery.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      action: 'GALLERY_DELETED',
      details: { galleryId: id },
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Gallery deleted');
  } catch (err) {
    next(err);
  }
}
