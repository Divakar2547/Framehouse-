"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGallery = createGallery;
exports.listGalleries = listGalleries;
exports.getGallery = getGallery;
exports.updateGallery = updateGallery;
exports.changePin = changePin;
exports.addPhotosToGallery = addPhotosToGallery;
exports.removePhotoFromGallery = removePhotoFromGallery;
exports.reorderGalleryPhotos = reorderGalleryPhotos;
exports.publishGallery = publishGallery;
exports.unpublishGallery = unpublishGallery;
exports.getGalleryAnalytics = getGalleryAnalytics;
exports.deleteGallery = deleteGallery;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const crypto_1 = require("../utils/crypto");
const prisma_1 = __importDefault(require("../config/prisma"));
// ─── Assert admin owns the event ──────────────────────────────────────────────
async function assertAdminOwnsEvent(eventId, userId) {
    const event = await prisma_1.default.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
    return !!event && event.ownerId === userId;
}
async function assertAdminOwnsGallery(galleryId, userId) {
    const gallery = await prisma_1.default.gallery.findUnique({
        where: { id: galleryId },
        include: { event: { select: { ownerId: true } } },
    });
    return !!gallery && gallery.event.ownerId === userId;
}
// ─── Create gallery ───────────────────────────────────────────────────────────
async function createGallery(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        const data = req.body;
        if (!(await assertAdminOwnsEvent(eventId, user.id))) {
            (0, response_1.sendError)(res, 'Event not found or access denied', 403);
            return;
        }
        const pinHash = await bcryptjs_1.default.hash(data.pin, 12);
        const slug = (0, crypto_1.generateSlug)(data.title);
        const gallery = await prisma_1.default.gallery.create({
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
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId, action: 'GALLERY_CREATED',
            details: { galleryTitle: gallery.title, slug: gallery.slug }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { gallery }, 'Gallery created', 201);
    }
    catch (err) {
        next(err);
    }
}
// ─── List galleries for an event ─────────────────────────────────────────────
async function listGalleries(req, res, next) {
    try {
        const user = req.user;
        const { id: eventId } = req.params;
        if (!(await assertAdminOwnsEvent(eventId, user.id))) {
            (0, response_1.sendError)(res, 'Event not found or access denied', 403);
            return;
        }
        const galleries = await prisma_1.default.gallery.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { photos: true } },
            },
        });
        (0, response_1.sendSuccess)(res, { galleries });
    }
    catch (err) {
        next(err);
    }
}
// ─── Get gallery (admin) ──────────────────────────────────────────────────────
async function getGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { id },
            include: {
                event: { select: { id: true, name: true, ownerId: true } },
                photos: {
                    include: {
                        photo: {
                            select: {
                                id: true, filename: true, originalFilename: true,
                                thumbnailStorageKey: true, width: true, height: true, status: true,
                            },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                _count: { select: { photos: true } },
            },
        });
        if (!gallery) {
            (0, response_1.sendError)(res, 'Gallery not found', 404);
            return;
        }
        if (gallery.event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        // Never return the PIN hash
        const { pinHash: _, ...safeGallery } = gallery;
        (0, response_1.sendSuccess)(res, { gallery: safeGallery });
    }
    catch (err) {
        next(err);
    }
}
// ─── Update gallery ───────────────────────────────────────────────────────────
async function updateGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const data = req.body;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        const updated = await prisma_1.default.gallery.update({
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
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, action: 'GALLERY_UPDATED',
            details: { galleryId: id, changes: data }, ipAddress: req.ip,
        });
        const { pinHash: _, ...safeGallery } = updated;
        (0, response_1.sendSuccess)(res, { gallery: safeGallery });
    }
    catch (err) {
        next(err);
    }
}
// ─── Change PIN ────────────────────────────────────────────────────────────────
async function changePin(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const { pin } = req.body;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        const pinHash = await bcryptjs_1.default.hash(pin, 12);
        await prisma_1.default.gallery.update({ where: { id }, data: { pinHash } });
        // Invalidate all existing sessions for this gallery
        await prisma_1.default.galleryAccess.deleteMany({ where: { galleryId: id } });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, action: 'GALLERY_PIN_CHANGED',
            details: { galleryId: id }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, null, 'Gallery PIN updated. All existing sessions have been revoked.');
    }
    catch (err) {
        next(err);
    }
}
// ─── Add photos to gallery ────────────────────────────────────────────────────
async function addPhotosToGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const { photoIds } = req.body;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { id },
            include: { event: { select: { ownerId: true, id: true } } },
        });
        if (!gallery || gallery.event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        // Validate photos belong to the event
        const photos = await prisma_1.default.photo.findMany({
            where: { id: { in: photoIds }, eventId: gallery.event.id, status: 'READY' },
            select: { id: true },
        });
        if (photos.length === 0) {
            (0, response_1.sendError)(res, 'No valid photos found', 400);
            return;
        }
        // Get current max sort order
        const maxOrder = await prisma_1.default.galleryPhoto.aggregate({
            where: { galleryId: id },
            _max: { sortOrder: true },
        });
        const startOrder = (maxOrder._max.sortOrder ?? -1) + 1;
        // Upsert gallery photos
        await prisma_1.default.$transaction(photos.map((photo, index) => prisma_1.default.galleryPhoto.upsert({
            where: { galleryId_photoId: { galleryId: id, photoId: photo.id } },
            create: { galleryId: id, photoId: photo.id, sortOrder: startOrder + index },
            update: {},
        })));
        (0, response_1.sendSuccess)(res, { added: photos.length }, `${photos.length} photos added to gallery`);
    }
    catch (err) {
        next(err);
    }
}
// ─── Remove photo from gallery ────────────────────────────────────────────────
async function removePhotoFromGallery(req, res, next) {
    try {
        const user = req.user;
        const { id, photoId } = req.params;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        await prisma_1.default.galleryPhoto.deleteMany({ where: { galleryId: id, photoId } });
        (0, response_1.sendSuccess)(res, null, 'Photo removed from gallery');
    }
    catch (err) {
        next(err);
    }
}
// ─── Reorder gallery photos ───────────────────────────────────────────────────
async function reorderGalleryPhotos(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const { photoOrders } = req.body;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        await prisma_1.default.$transaction(photoOrders.map(({ galleryPhotoId, sortOrder }) => prisma_1.default.galleryPhoto.update({
            where: { id: galleryPhotoId },
            data: { sortOrder },
        })));
        (0, response_1.sendSuccess)(res, null, 'Photos reordered');
    }
    catch (err) {
        next(err);
    }
}
// ─── Publish gallery ──────────────────────────────────────────────────────────
async function publishGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { id },
            include: {
                event: { select: { ownerId: true, name: true } },
                _count: { select: { photos: true } },
            },
        });
        if (!gallery || gallery.event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        if (gallery._count.photos === 0) {
            (0, response_1.sendError)(res, 'Cannot publish a gallery with no photos', 400);
            return;
        }
        const updated = await prisma_1.default.gallery.update({
            where: { id },
            data: { isPublished: true, publishedAt: new Date(), status: 'PUBLISHED' },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: gallery.eventId, action: 'GALLERY_PUBLISHED',
            details: { galleryTitle: gallery.title, slug: gallery.slug }, ipAddress: req.ip,
        });
        await prisma_1.default.notification.create({
            data: {
                userId: user.id,
                title: 'Gallery Published',
                message: `Gallery "${gallery.title}" for "${gallery.event.name}" is now live.`,
                type: 'gallery',
            },
        });
        const { pinHash: _, ...safeGallery } = updated;
        const clientOrigin = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
        (0, response_1.sendSuccess)(res, { gallery: safeGallery, shareUrl: `${clientOrigin}/gallery/${gallery.slug}` }, 'Gallery published');
    }
    catch (err) {
        next(err);
    }
}
// ─── Unpublish gallery ────────────────────────────────────────────────────────
async function unpublishGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { id },
            include: { event: { select: { ownerId: true } } },
        });
        if (!gallery || gallery.event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        const updated = await prisma_1.default.gallery.update({
            where: { id },
            data: { isPublished: false, status: 'UNPUBLISHED' },
        });
        // Revoke all active gallery sessions
        await prisma_1.default.galleryAccess.deleteMany({ where: { galleryId: id } });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: gallery.eventId, action: 'GALLERY_UNPUBLISHED',
            details: { galleryId: id }, ipAddress: req.ip,
        });
        const { pinHash: _, ...safeGallery } = updated;
        (0, response_1.sendSuccess)(res, { gallery: safeGallery }, 'Gallery unpublished');
    }
    catch (err) {
        next(err);
    }
}
// ─── Gallery analytics (admin) ────────────────────────────────────────────────
async function getGalleryAnalytics(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        const [gallery, views, downloads, topPhotos] = await Promise.all([
            prisma_1.default.gallery.findUnique({
                where: { id },
                select: { id: true, title: true, viewCount: true, downloadCount: true, publishedAt: true, isPublished: true },
            }),
            prisma_1.default.galleryView.groupBy({
                by: ['sessionId'],
                where: { galleryId: id },
                _count: true,
            }),
            prisma_1.default.photoDownload.groupBy({
                by: ['photoId'],
                where: { galleryId: id },
                _count: true,
                orderBy: { _count: { photoId: 'desc' } },
                take: 10,
            }),
            prisma_1.default.galleryView.findMany({
                where: { galleryId: id },
                orderBy: { viewedAt: 'desc' },
                take: 1,
                select: { viewedAt: true },
            }),
        ]);
        const uniqueSessionCount = views.length;
        const lastAccess = topPhotos.length > 0 ? topPhotos[0] : null;
        const recentViews = await prisma_1.default.galleryView.count({
            where: { galleryId: id, viewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        });
        (0, response_1.sendSuccess)(res, {
            gallery,
            uniqueVisitors: uniqueSessionCount,
            recentViews,
            topDownloadedPhotos: downloads,
            lastAccessedAt: topPhotos[0]?.viewedAt ?? null,
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Delete gallery ───────────────────────────────────────────────────────────
async function deleteGallery(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        if (!(await assertAdminOwnsGallery(id, user.id))) {
            (0, response_1.sendError)(res, 'Gallery not found or access denied', 403);
            return;
        }
        await prisma_1.default.gallery.delete({ where: { id } });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, action: 'GALLERY_DELETED',
            details: { galleryId: id }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, null, 'Gallery deleted');
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=gallery.controller.js.map