"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicGallery = getPublicGallery;
exports.verifyPin = verifyPin;
exports.listGalleryPhotos = listGalleryPhotos;
exports.downloadPhoto = downloadPhoto;
exports.favoritePhoto = favoritePhoto;
exports.listFavorites = listFavorites;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const response_1 = require("../utils/response");
const crypto_1 = require("../utils/crypto");
const s3_service_1 = require("../services/s3.service");
const prisma_1 = __importDefault(require("../config/prisma"));
const env_1 = require("../config/env");
const GALLERY_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const GALLERY_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env_1.env.isProduction,
    sameSite: 'lax',
    maxAge: GALLERY_SESSION_TTL_MS,
    path: '/',
};
// ─── Get gallery info (public — no PIN required) ──────────────────────────────
async function getPublicGallery(req, res, next) {
    try {
        const { slug } = req.params;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { slug },
            select: {
                id: true, title: true, description: true, slug: true,
                isPublished: true, publishedAt: true, expiresAt: true,
                allowDownloads: true, showWatermark: true, status: true,
                event: { select: { name: true, eventDate: true, location: true } },
                _count: { select: { photos: true } },
            },
        });
        // Return the same 404 whether the slug doesn't exist or the gallery is unpublished
        // to prevent enumeration attacks
        if (!gallery || !gallery.isPublished) {
            (0, response_1.sendError)(res, 'Gallery not found', 404);
            return;
        }
        if (gallery.expiresAt && gallery.expiresAt < new Date()) {
            (0, response_1.sendSuccess)(res, { expired: true, message: 'This gallery is no longer available.' });
            return;
        }
        (0, response_1.sendSuccess)(res, {
            gallery: {
                id: gallery.id,
                title: gallery.title,
                description: gallery.description,
                slug: gallery.slug,
                allowDownloads: gallery.allowDownloads,
                showWatermark: gallery.showWatermark,
                photoCount: gallery._count.photos,
                event: gallery.event,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Verify PIN ───────────────────────────────────────────────────────────────
async function verifyPin(req, res, next) {
    try {
        const { slug } = req.params;
        const { pin } = req.body;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { slug },
            select: { id: true, pinHash: true, isPublished: true, expiresAt: true },
        });
        // Constant-time response — don't reveal whether slug exists
        const dummyHash = '$2a$12$dummyhashfortimingsafety.xxxxxxxxxxxxxxxxxxx';
        const pinToCheck = gallery?.pinHash ?? dummyHash;
        const correct = await bcryptjs_1.default.compare(pin, pinToCheck);
        if (!gallery || !gallery.isPublished || !correct) {
            (0, response_1.sendError)(res, 'Incorrect PIN', 401);
            return;
        }
        if (gallery.expiresAt && gallery.expiresAt < new Date()) {
            (0, response_1.sendError)(res, 'This gallery has expired', 403);
            return;
        }
        // Create session
        const sessionToken = (0, crypto_1.generateSecureToken)(32);
        const sessionTokenHash = (0, crypto_1.hashToken)(sessionToken);
        const expiresAt = new Date(Date.now() + GALLERY_SESSION_TTL_MS);
        const session = await prisma_1.default.galleryAccess.create({
            data: { galleryId: gallery.id, sessionTokenHash, expiresAt },
        });
        // Track gallery view
        const ipHash = req.ip ? (0, crypto_1.hashIp)(req.ip) : undefined;
        await prisma_1.default.galleryView.create({
            data: { galleryId: gallery.id, sessionId: session.id, ipHash },
        });
        await prisma_1.default.gallery.update({
            where: { id: gallery.id },
            data: { viewCount: { increment: 1 } },
        });
        res.cookie('gallery_session', sessionToken, GALLERY_COOKIE_OPTIONS);
        (0, response_1.sendSuccess)(res, { sessionId: session.id }, 'PIN verified successfully');
    }
    catch (err) {
        next(err);
    }
}
// ─── List gallery photos (requires session) ───────────────────────────────────
async function listGalleryPhotos(req, res, next) {
    try {
        const { galleryId } = req.gallerySession;
        const { page, limit } = req.query;
        const { page: pageNum, limit: limitNum, skip } = (0, response_1.getPagination)(page, limit);
        const [galleryPhotos, total] = await Promise.all([
            prisma_1.default.galleryPhoto.findMany({
                where: { galleryId },
                skip,
                take: limitNum,
                orderBy: { sortOrder: 'asc' },
                include: {
                    photo: {
                        select: {
                            id: true, filename: true, originalFilename: true,
                            thumbnailStorageKey: true, galleryStorageKey: true,
                            width: true, height: true,
                        },
                    },
                },
            }),
            prisma_1.default.galleryPhoto.count({ where: { galleryId } }),
        ]);
        // Generate presigned thumbnail URLs for this page
        const photosWithUrls = await Promise.all(galleryPhotos.map(async (gp) => {
            const thumbnailUrl = gp.photo.thumbnailStorageKey
                ? await (0, s3_service_1.generateViewPresignedUrl)(gp.photo.thumbnailStorageKey, 3600)
                : null;
            const galleryUrl = gp.photo.galleryStorageKey
                ? await (0, s3_service_1.generateViewPresignedUrl)(gp.photo.galleryStorageKey, 3600)
                : null;
            return {
                id: gp.photo.id,
                galleryPhotoId: gp.id,
                sortOrder: gp.sortOrder,
                filename: gp.photo.originalFilename,
                width: gp.photo.width,
                height: gp.photo.height,
                thumbnailUrl,
                galleryUrl,
            };
        }));
        (0, response_1.sendSuccess)(res, { photos: photosWithUrls }, undefined, 200, {
            page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Download photo ───────────────────────────────────────────────────────────
async function downloadPhoto(req, res, next) {
    try {
        const { galleryId, sessionId } = req.gallerySession;
        const { photoId } = req.params;
        const gallery = await prisma_1.default.gallery.findUnique({
            where: { id: galleryId },
            select: { allowDownloads: true, showWatermark: true },
        });
        if (!gallery?.allowDownloads) {
            (0, response_1.sendError)(res, 'Downloads are not enabled for this gallery', 403);
            return;
        }
        const galleryPhoto = await prisma_1.default.galleryPhoto.findUnique({
            where: { galleryId_photoId: { galleryId, photoId } },
            include: {
                photo: {
                    select: {
                        id: true, originalFilename: true, storageKey: true,
                        galleryStorageKey: true,
                    },
                },
            },
        });
        if (!galleryPhoto) {
            (0, response_1.sendError)(res, 'Photo not found in gallery', 404);
            return;
        }
        // Use gallery version for downloads (respects watermark)
        const downloadKey = gallery.showWatermark
            ? (galleryPhoto.photo.galleryStorageKey ?? galleryPhoto.photo.storageKey)
            : galleryPhoto.photo.storageKey;
        const signedUrl = await (0, s3_service_1.generateDownloadPresignedUrl)(downloadKey, galleryPhoto.photo.originalFilename, 600);
        // Track download
        await prisma_1.default.photoDownload.create({ data: { galleryId, photoId, sessionId } });
        await prisma_1.default.gallery.update({ where: { id: galleryId }, data: { downloadCount: { increment: 1 } } });
        (0, response_1.sendSuccess)(res, { signedUrl, expiresIn: 600 });
    }
    catch (err) {
        next(err);
    }
}
// ─── Favorite a photo ─────────────────────────────────────────────────────────
async function favoritePhoto(req, res, next) {
    try {
        const { galleryId, sessionId } = req.gallerySession;
        const { photoId } = req.params;
        // Verify photo is in gallery
        const galleryPhoto = await prisma_1.default.galleryPhoto.findUnique({
            where: { galleryId_photoId: { galleryId, photoId } },
        });
        if (!galleryPhoto) {
            (0, response_1.sendError)(res, 'Photo not found in gallery', 404);
            return;
        }
        const existing = await prisma_1.default.photoFavorite.findUnique({
            where: { galleryId_photoId_sessionId: { galleryId, photoId, sessionId } },
        });
        if (existing) {
            await prisma_1.default.photoFavorite.delete({
                where: { galleryId_photoId_sessionId: { galleryId, photoId, sessionId } },
            });
            (0, response_1.sendSuccess)(res, { favorited: false }, 'Removed from favorites');
        }
        else {
            await prisma_1.default.photoFavorite.create({ data: { galleryId, photoId, sessionId } });
            (0, response_1.sendSuccess)(res, { favorited: true }, 'Added to favorites');
        }
    }
    catch (err) {
        next(err);
    }
}
// ─── Get favorites ────────────────────────────────────────────────────────────
async function listFavorites(req, res, next) {
    try {
        const { galleryId, sessionId } = req.gallerySession;
        const favorites = await prisma_1.default.photoFavorite.findMany({
            where: { galleryId, sessionId },
            include: {
                photo: {
                    select: {
                        id: true, originalFilename: true, thumbnailStorageKey: true,
                        galleryStorageKey: true, width: true, height: true,
                    },
                },
            },
        });
        const favoritesWithUrls = await Promise.all(favorites.map(async (fav) => {
            const thumbnailUrl = fav.photo.thumbnailStorageKey
                ? await (0, s3_service_1.generateViewPresignedUrl)(fav.photo.thumbnailStorageKey, 3600)
                : null;
            const galleryUrl = fav.photo.galleryStorageKey
                ? await (0, s3_service_1.generateViewPresignedUrl)(fav.photo.galleryStorageKey, 3600)
                : null;
            return {
                id: fav.photo.id,
                filename: fav.photo.originalFilename,
                width: fav.photo.width,
                height: fav.photo.height,
                thumbnailUrl,
                galleryUrl,
            };
        }));
        (0, response_1.sendSuccess)(res, { favorites: favoritesWithUrls, count: favoritesWithUrls.length });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=public.controller.js.map