import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendSuccess, sendError, getPagination } from '../utils/response.js';
import { createAuditLog } from '../utils/auditLog.js';
import {
  generateUploadPresignedUrl,
  generateViewPresignedUrl,
  getObjectBuffer,
  deleteObjects,
  buildStorageKey,
} from '../services/s3.service.js';
import { processAndUploadVariants } from '../services/image.service.js';
import prisma from '../config/prisma.js';

// ─── Authorization helper ─────────────────────────────────────────────────────

async function assertEventAccess(eventId, userId, role) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  if (!event) return null;
  if (role === 'ADMIN' && event.ownerId !== userId) return null;
  if (role === 'TEAM_MEMBER') {
    const isMember = event.members.some(m => m.userId === userId);
    if (!isMember) return null;
  }
  return true;
}

// ─── Generate S3 upload URL ───────────────────────────────────────────────────

export async function getUploadUrl(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;
    const data = req.body;

    const access = await assertEventAccess(eventId, user.id, user.role);
    if (!access) {
      sendError(res, 'Event not found or access denied', 403);
      return;
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedMimes.includes(data.mimeType)) {
      sendError(res, 'File type not allowed', 400);
      return;
    }

    // Duplicate detection
    const duplicate = await prisma.photo.findFirst({
      where: { eventId, checksum: data.checksum, status: { not: 'DELETED' } },
      select: { id: true, filename: true },
    });

    if (duplicate) {
      sendSuccess(res, { duplicate: true, existingPhoto: duplicate }, 'Duplicate photo detected');
      return;
    }

    const photoId = crypto.randomBytes(12).toString('hex');
    const ext = data.filename.split('.').pop()?.toLowerCase() || 'jpg';
    const safeFilename = `${photoId}.${ext}`;
    const storageKey = buildStorageKey(eventId, photoId, 'originals', safeFilename);

    // Create photo record in UPLOADING state
    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        eventId,
        uploadedById: user.id,
        filename: safeFilename,
        originalFilename: data.filename,
        storageKey,
        mimeType: data.mimeType,
        fileSize: BigInt(data.fileSize),
        checksum: data.checksum,
        status: 'UPLOADING',
        uploadBatchId: data.uploadBatchId ?? uuidv4(),
      },
    });

    const presignedUrl = await generateUploadPresignedUrl(storageKey, data.mimeType);

    sendSuccess(res, { photoId: photo.id, presignedUrl, storageKey }, undefined, 201);
  } catch (err) {
    next(err);
  }
}

// ─── Complete upload ──────────────────────────────────────────────────────────

export async function completeUpload(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;
    const data = req.body;

    const photo = await prisma.photo.findUnique({
      where: { id: data.photoId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            galleries: {
              where: { showWatermark: true },
              select: { showWatermark: true, watermarkText: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!photo) {
      sendError(res, 'Photo record not found', 404);
      return;
    }
    if (photo.eventId !== eventId) {
      sendError(res, 'Photo does not belong to this event', 400);
      return;
    }
    if (photo.uploadedById !== user.id && user.role !== 'ADMIN') {
      sendError(res, 'Access denied', 403);
      return;
    }

    // Set status to PROCESSING before image transformation starts
    await prisma.photo.update({
      where: { id: data.photoId },
      data: {
        status: 'PROCESSING',
        fileSize: BigInt(data.fileSize),
      },
    });

    try {
      // 1. Fetch original image buffer
      const originalBuffer = await getObjectBuffer(photo.storageKey);

      // 2. Process variants with Sharp
      const watermark = photo.event?.galleries?.[0]?.showWatermark
        ? { text: photo.event.galleries[0].watermarkText || 'Framehouse' }
        : undefined;

      const variants = await processAndUploadVariants(
        originalBuffer,
        eventId,
        photo.id,
        photo.originalFilename,
        watermark
      );

      // 3. Mark READY only after Sharp processing succeeds
      const updated = await prisma.photo.update({
        where: { id: data.photoId },
        data: {
          status: 'READY',
          thumbnailStorageKey: variants.thumbnailKey,
          mediumStorageKey: variants.mediumKey,
          galleryStorageKey: variants.galleryKey,
          width: variants.width,
          height: variants.height,
          fileSize: BigInt(data.fileSize),
        },
      });

      // Notify event owner
      if (photo.event) {
        const batchPhotos = await prisma.photo.count({
          where: { uploadBatchId: photo.uploadBatchId, eventId },
        });
        await prisma.notification.create({
          data: {
            userId: photo.event.ownerId,
            title: 'Photos Uploaded',
            message: `${user.name} uploaded photos to "${photo.event.name}". Batch total: ${batchPhotos} photos.`,
            type: 'upload',
          },
        }).catch(() => {});
      }

      await createAuditLog({
        userId: user.id,
        eventId,
        action: 'PHOTOS_UPLOADED',
        details: { photoId: data.photoId, filename: photo.originalFilename },
        ipAddress: req.ip,
      });

      sendSuccess(res, { photo: updated }, 'Upload completed');
    } catch (processErr) {
      console.error('Sharp variant processing failed:', processErr);
      await prisma.photo.update({
        where: { id: data.photoId },
        data: { status: 'FAILED' },
      }).catch(() => {});
      sendError(res, 'Image processing failed', 422);
    }
  } catch (err) {
    next(err);
  }
}

// ─── List photos ──────────────────────────────────────────────────────────────

export async function listPhotos(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;
    const {
      page, limit, status, isSelected, uploadedById, search,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const access = await assertEventAccess(eventId, user.id, user.role);
    if (!access) {
      sendError(res, 'Event not found or access denied', 403);
      return;
    }

    const { page: pageNum, limit: limitNum, skip } = getPagination(page, limit);

    const where = {
      eventId,
      status: { not: 'DELETED' },
    };

    // Team members can only see their own uploads
    if (user.role === 'TEAM_MEMBER') {
      where.uploadedById = user.id;
    } else if (uploadedById) {
      where.uploadedById = uploadedById;
    }

    if (status) where.status = status;
    if (isSelected !== undefined) where.isSelected = isSelected === 'true';
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { originalFilename: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, eventId: true, filename: true, originalFilename: true,
          storageKey: true, thumbnailStorageKey: true, mediumStorageKey: true,
          galleryStorageKey: true, mimeType: true, fileSize: true,
          width: true, height: true, status: true, isSelected: true,
          uploadBatchId: true, createdAt: true,
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.photo.count({ where }),
    ]);

    const photosWithUrls = await Promise.all(
      photos.map(async (p) => {
        const key = p.thumbnailStorageKey || p.galleryStorageKey || p.storageKey;
        const thumbnailUrl = key ? await generateViewPresignedUrl(key, 3600) : null;
        return {
          ...p,
          thumbnailUrl,
        };
      })
    );

    sendSuccess(res, { photos: photosWithUrls }, undefined, 200, {
      page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Toggle photo selection ───────────────────────────────────────────────────

export async function updatePhotoSelection(req, res, next) {
  try {
    const user = req.user;
    const { id: photoId } = req.params;
    const { isSelected } = req.body;

    const photo = await prisma.photo.findUnique({ where: { id: photoId }, select: { eventId: true } });
    if (!photo) {
      sendError(res, 'Photo not found', 404);
      return;
    }

    const event = await prisma.event.findUnique({ where: { id: photo.eventId }, select: { ownerId: true } });
    if (!event || event.ownerId !== user.id) {
      sendError(res, 'Access denied', 403);
      return;
    }

    const updated = await prisma.photo.update({ where: { id: photoId }, data: { isSelected } });

    await createAuditLog({
      userId: user.id,
      eventId: photo.eventId,
      action: isSelected ? 'PHOTO_SELECTED' : 'PHOTO_DESELECTED',
      details: { photoId },
      ipAddress: req.ip,
    });

    sendSuccess(res, { photo: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Bulk selection ───────────────────────────────────────────────────────────

export async function bulkSelectPhotos(req, res, next) {
  try {
    const user = req.user;
    const { id: eventId } = req.params;
    const { photoIds, isSelected } = req.body;

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
    if (!event || event.ownerId !== user.id) {
      sendError(res, 'Access denied', 403);
      return;
    }

    // Ensure all photos belong to this event
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, eventId },
      select: { id: true },
    });

    if (photos.length !== photoIds.length) {
      sendError(res, 'Some photos do not belong to this event', 400);
      return;
    }

    const { count } = await prisma.photo.updateMany({
      where: { id: { in: photoIds }, eventId },
      data: { isSelected },
    });

    await createAuditLog({
      userId: user.id,
      eventId,
      action: isSelected ? 'PHOTOS_BULK_SELECTED' : 'PHOTOS_BULK_DESELECTED',
      details: { count, photoIds },
      ipAddress: req.ip,
    });

    sendSuccess(res, { updated: count }, `${count} photos ${isSelected ? 'selected' : 'deselected'}`);
  } catch (err) {
    next(err);
  }
}

// ─── Delete photo ─────────────────────────────────────────────────────────────

export async function deletePhoto(req, res, next) {
  try {
    const user = req.user;
    const { id: photoId } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { event: { select: { ownerId: true } } },
    });
    if (!photo) {
      sendError(res, 'Photo not found', 404);
      return;
    }

    const canDelete = photo.event.ownerId === user.id || photo.uploadedById === user.id;
    if (!canDelete) {
      sendError(res, 'Access denied', 403);
      return;
    }

    await prisma.photo.update({ where: { id: photoId }, data: { status: 'DELETED' } });
    await prisma.galleryPhoto.deleteMany({ where: { photoId } });

    const keysToDelete = [
      photo.storageKey,
      photo.galleryStorageKey,
      photo.thumbnailStorageKey,
      photo.mediumStorageKey,
    ].filter(Boolean);

    setImmediate(async () => {
      try {
        await deleteObjects(keysToDelete);
      } catch {}
    });

    await createAuditLog({
      userId: user.id,
      eventId: photo.eventId,
      action: 'PHOTO_DELETED',
      details: { photoId, filename: photo.originalFilename },
      ipAddress: req.ip,
    });

    sendSuccess(res, null, 'Photo deleted');
  } catch (err) {
    next(err);
  }
}

// ─── Get signed view/download URL ────────────────────────────────────────────

export async function getSignedUrl(req, res, next) {
  try {
    const user = req.user;
    const { id: photoId } = req.params;
    const { variant = 'gallery' } = req.query;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: { event: { select: { ownerId: true, members: { select: { userId: true } } } } },
    });
    if (!photo || photo.status === 'DELETED') {
      sendError(res, 'Photo not found', 404);
      return;
    }

    if (user.role === 'ADMIN' && photo.event.ownerId !== user.id) {
      sendError(res, 'Access denied', 403);
      return;
    }
    if (user.role === 'TEAM_MEMBER') {
      const isMember = photo.event.members.some(m => m.userId === user.id);
      if (!isMember) {
        sendError(res, 'Access denied', 403);
        return;
      }
    }

    let key = null;
    if (variant === 'thumbnail') key = photo.thumbnailStorageKey;
    else if (variant === 'original') key = photo.storageKey;
    else if (variant === 'medium') key = photo.mediumStorageKey;
    else key = photo.galleryStorageKey ?? photo.storageKey;

    if (!key) {
      sendError(res, 'Requested variant not available', 404);
      return;
    }

    const signedUrl = await generateViewPresignedUrl(key);
    sendSuccess(res, { signedUrl, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
}
