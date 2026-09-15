"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadUrl = getUploadUrl;
exports.completeUpload = completeUpload;
exports.listPhotos = listPhotos;
exports.updatePhotoSelection = updatePhotoSelection;
exports.bulkSelectPhotos = bulkSelectPhotos;
exports.deletePhoto = deletePhoto;
exports.getSignedUrl = getSignedUrl;
const uuid_1 = require("uuid");
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const s3_service_1 = require("../services/s3.service");
const prisma_1 = __importDefault(require("../config/prisma"));
// ─── Authorization helper ─────────────────────────────────────────────────────
async function assertEventAccess(eventId, userId, role) {
    const event = await prisma_1.default.event.findUnique({
        where: { id: eventId },
        select: { ownerId: true, members: { select: { userId: true } } },
    });
    if (!event)
        return null;
    if (role === 'ADMIN' && event.ownerId !== userId)
        return null;
    if (role === 'TEAM_MEMBER') {
        const isMember = event.members.some(m => m.userId === userId);
        if (!isMember)
            return null;
    }
    return true;
}
// ─── Generate S3 upload URL ───────────────────────────────────────────────────
async function getUploadUrl(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        const data = req.body;
        const access = await assertEventAccess(eventId, user.id, user.role);
        if (!access) {
            (0, response_1.sendError)(res, 'Event not found or access denied', 403);
            return;
        }
        // Validate file type
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowedMimes.includes(data.mimeType)) {
            (0, response_1.sendError)(res, 'File type not allowed', 400);
            return;
        }
        // Duplicate detection
        const duplicate = await prisma_1.default.photo.findFirst({
            where: { eventId, checksum: data.checksum, status: { not: 'DELETED' } },
            select: { id: true, filename: true },
        });
        if (duplicate) {
            (0, response_1.sendSuccess)(res, { duplicate: true, existingPhoto: duplicate }, 'Duplicate photo detected');
            return;
        }
        const photoId = (0, uuid_1.v4)().replace(/-/g, '');
        const ext = data.filename.split('.').pop()?.toLowerCase() || 'jpg';
        const safeFilename = `${photoId}.${ext}`;
        const storageKey = (0, s3_service_1.buildStorageKey)(eventId, photoId, 'originals', safeFilename);
        // Create photo record in UPLOADING state
        const photo = await prisma_1.default.photo.create({
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
                uploadBatchId: data.uploadBatchId ?? (0, uuid_1.v4)(),
            },
        });
        const presignedUrl = await (0, s3_service_1.generateUploadPresignedUrl)(storageKey, data.mimeType);
        (0, response_1.sendSuccess)(res, { photoId: photo.id, presignedUrl, storageKey }, undefined, 201);
    }
    catch (err) {
        next(err);
    }
}
// ─── Complete upload ──────────────────────────────────────────────────────────
async function completeUpload(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        const data = req.body;
        const photo = await prisma_1.default.photo.findUnique({ where: { id: data.photoId } });
        if (!photo) {
            (0, response_1.sendError)(res, 'Photo record not found', 404);
            return;
        }
        if (photo.eventId !== eventId) {
            (0, response_1.sendError)(res, 'Photo does not belong to this event', 400);
            return;
        }
        if (photo.uploadedById !== user.id && user.role !== 'ADMIN') {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        // Update to PROCESSING — image processing worker (or inline here) will set READY
        const updated = await prisma_1.default.photo.update({
            where: { id: data.photoId },
            data: {
                status: 'PROCESSING',
                fileSize: BigInt(data.fileSize),
                ...(data.width && { width: data.width }),
                ...(data.height && { height: data.height }),
            },
        });
        // Queue async processing — in production this would be a job queue.
        // For this implementation we trigger it in the background.
        setImmediate(async () => {
            try {
                await prisma_1.default.photo.update({
                    where: { id: data.photoId },
                    data: { status: 'READY' },
                });
                // Notify event owner
                const event = await prisma_1.default.event.findUnique({
                    where: { id: eventId },
                    select: { ownerId: true, name: true },
                });
                if (event) {
                    const batchPhotos = await prisma_1.default.photo.count({
                        where: { uploadBatchId: photo.uploadBatchId, eventId },
                    });
                    // Only create one notification per batch upload (debounced by batch)
                    await prisma_1.default.notification.upsert({
                        where: {
                            // Use a deterministic ID based on batch so we don't spam
                            id: `batch-${photo.uploadBatchId}-notify`,
                        },
                        create: {
                            id: `batch-${photo.uploadBatchId}-notify`,
                            userId: event.ownerId,
                            title: 'Photos Uploaded',
                            message: `${user.name} uploaded photos to "${event.name}". Batch total: ${batchPhotos} photos.`,
                            type: 'upload',
                        },
                        update: {
                            message: `${user.name} uploaded photos to "${event.name}". Batch total: ${batchPhotos} photos.`,
                            isRead: false,
                            createdAt: new Date(),
                        },
                    }).catch(() => { });
                }
            }
            catch (processErr) {
                console.error('Post-upload processing error:', processErr);
                await prisma_1.default.photo.update({ where: { id: data.photoId }, data: { status: 'FAILED' } }).catch(() => { });
            }
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId, action: 'PHOTOS_UPLOADED',
            details: { photoId: data.photoId, filename: photo.originalFilename },
            ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { photo: updated }, 'Upload completed');
    }
    catch (err) {
        next(err);
    }
}
// ─── List photos ──────────────────────────────────────────────────────────────
async function listPhotos(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        const { page, limit, status, isSelected, uploadedById, search, sortBy = 'createdAt', sortOrder = 'desc', } = req.query;
        const access = await assertEventAccess(eventId, user.id, user.role);
        if (!access) {
            (0, response_1.sendError)(res, 'Event not found or access denied', 403);
            return;
        }
        const { page: pageNum, limit: limitNum, skip } = (0, response_1.getPagination)(page, limit);
        const where = {
            eventId,
            status: { not: 'DELETED' },
        };
        // Team members can only see their own uploads
        if (user.role === 'TEAM_MEMBER') {
            where.uploadedById = user.id;
        }
        else if (uploadedById) {
            where.uploadedById = uploadedById;
        }
        if (status)
            where.status = status;
        if (isSelected !== undefined)
            where.isSelected = isSelected === 'true';
        if (search) {
            where.OR = [
                { filename: { contains: search, mode: 'insensitive' } },
                { originalFilename: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [photos, total] = await Promise.all([
            prisma_1.default.photo.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { [sortBy]: sortOrder },
                select: {
                    id: true, eventId: true, filename: true, originalFilename: true,
                    thumbnailStorageKey: true, mimeType: true, fileSize: true,
                    width: true, height: true, status: true, isSelected: true,
                    uploadBatchId: true, createdAt: true,
                    uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
                },
            }),
            prisma_1.default.photo.count({ where }),
        ]);
        (0, response_1.sendSuccess)(res, { photos }, undefined, 200, {
            page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Toggle photo selection ───────────────────────────────────────────────────
async function updatePhotoSelection(req, res, next) {
    try {
        const user = req.user;
        const { id: photoId } = req.params;
        const { isSelected } = req.body;
        const photo = await prisma_1.default.photo.findUnique({ where: { id: photoId }, select: { eventId: true } });
        if (!photo) {
            (0, response_1.sendError)(res, 'Photo not found', 404);
            return;
        }
        const event = await prisma_1.default.event.findUnique({ where: { id: photo.eventId }, select: { ownerId: true } });
        if (!event || event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        const updated = await prisma_1.default.photo.update({ where: { id: photoId }, data: { isSelected } });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: photo.eventId,
            action: isSelected ? 'PHOTO_SELECTED' : 'PHOTO_DESELECTED',
            details: { photoId }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { photo: updated });
    }
    catch (err) {
        next(err);
    }
}
// ─── Bulk selection ───────────────────────────────────────────────────────────
async function bulkSelectPhotos(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        const { photoIds, isSelected } = req.body;
        const event = await prisma_1.default.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
        if (!event || event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        // Ensure all photos belong to this event
        const photos = await prisma_1.default.photo.findMany({
            where: { id: { in: photoIds }, eventId },
            select: { id: true },
        });
        if (photos.length !== photoIds.length) {
            (0, response_1.sendError)(res, 'Some photos do not belong to this event', 400);
            return;
        }
        const { count } = await prisma_1.default.photo.updateMany({
            where: { id: { in: photoIds }, eventId },
            data: { isSelected },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId,
            action: isSelected ? 'PHOTOS_BULK_SELECTED' : 'PHOTOS_BULK_DESELECTED',
            details: { count, photoIds }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { updated: count }, `${count} photos ${isSelected ? 'selected' : 'deselected'}`);
    }
    catch (err) {
        next(err);
    }
}
// ─── Delete photo ─────────────────────────────────────────────────────────────
async function deletePhoto(req, res, next) {
    try {
        const user = req.user;
        const { id: photoId } = req.params;
        const photo = await prisma_1.default.photo.findUnique({
            where: { id: photoId },
            include: { event: { select: { ownerId: true } } },
        });
        if (!photo) {
            (0, response_1.sendError)(res, 'Photo not found', 404);
            return;
        }
        // Admin (event owner) or the uploader can delete
        const canDelete = photo.event.ownerId === user.id || photo.uploadedById === user.id;
        if (!canDelete) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        // Soft delete — mark as DELETED, clean S3 keys async
        await prisma_1.default.photo.update({ where: { id: photoId }, data: { status: 'DELETED' } });
        // Remove from galleries
        await prisma_1.default.galleryPhoto.deleteMany({ where: { photoId } });
        // Clean up S3 in background
        const keysToDelete = [
            photo.storageKey,
            photo.galleryStorageKey,
            photo.thumbnailStorageKey,
            photo.mediumStorageKey,
        ].filter(Boolean);
        setImmediate(async () => {
            try {
                await (0, s3_service_1.deleteObjects)(keysToDelete);
            }
            catch { }
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: photo.eventId, action: 'PHOTO_DELETED',
            details: { photoId, filename: photo.originalFilename }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, null, 'Photo deleted');
    }
    catch (err) {
        next(err);
    }
}
// ─── Get signed view/download URL ────────────────────────────────────────────
async function getSignedUrl(req, res, next) {
    try {
        const user = req.user;
        const { id: photoId } = req.params;
        const { variant = 'gallery' } = req.query;
        const photo = await prisma_1.default.photo.findUnique({
            where: { id: photoId },
            include: { event: { select: { ownerId: true, members: { select: { userId: true } } } } },
        });
        if (!photo || photo.status === 'DELETED') {
            (0, response_1.sendError)(res, 'Photo not found', 404);
            return;
        }
        // Authorization
        if (user.role === 'ADMIN' && photo.event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        if (user.role === 'TEAM_MEMBER') {
            const isMember = photo.event.members.some(m => m.userId === user.id);
            if (!isMember) {
                (0, response_1.sendError)(res, 'Access denied', 403);
                return;
            }
        }
        let key = null;
        if (variant === 'thumbnail')
            key = photo.thumbnailStorageKey;
        else if (variant === 'original')
            key = photo.storageKey;
        else if (variant === 'medium')
            key = photo.mediumStorageKey;
        else
            key = photo.galleryStorageKey ?? photo.storageKey;
        if (!key) {
            (0, response_1.sendError)(res, 'Requested variant not available', 404);
            return;
        }
        const signedUrl = await (0, s3_service_1.generateViewPresignedUrl)(key);
        (0, response_1.sendSuccess)(res, { signedUrl, expiresIn: 3600 });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=photo.controller.js.map