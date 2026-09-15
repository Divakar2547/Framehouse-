import bcrypt from 'bcryptjs';
import { sendSuccess, sendError, getPagination } from '../utils/response.js';
import { generateSecureToken, hashToken, hashIp } from '../utils/crypto.js';
import { generateDownloadPresignedUrl, generateViewPresignedUrl } from '../services/s3.service.js';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';

const GALLERY_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const GALLERY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  maxAge: GALLERY_SESSION_TTL_MS,
  path: '/',
};

// ─── Get gallery info (public — no PIN required) ──────────────────────────────

export async function getPublicGallery(req, res, next) {
  try {
    const { slug } = req.params;

    const gallery = await prisma.gallery.findUnique({
      where: { slug },
      select: {
        id: true, title: true, description: true, slug: true,
        isPublished: true, publishedAt: true, expiresAt: true,
        allowDownloads: true, showWatermark: true, status: true,
        event: { select: { name: true, eventDate: true, location: true } },
        _count: { select: { photos: true } },
      },
    });

    if (!gallery || !gallery.isPublished) {
      sendError(res, 'Gallery not found', 404);
      return;
    }

    if (gallery.expiresAt && gallery.expiresAt < new Date()) {
      sendSuccess(res, { expired: true, message: 'This gallery is no longer available.' });
      return;
    }

    sendSuccess(res, {
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
  } catch (err) {
    next(err);
  }
}

// ─── Verify PIN ───────────────────────────────────────────────────────────────

export async function verifyPin(req, res, next) {
  try {
    const { slug } = req.params;
    const { pin } = req.body;

    const gallery = await prisma.gallery.findUnique({
      where: { slug },
      select: { id: true, pinHash: true, isPublished: true, expiresAt: true },
    });

    const dummyHash = '$2a$12$dummyhashfortimingsafety.xxxxxxxxxxxxxxxxxxx';
    const pinToCheck = gallery?.pinHash ?? dummyHash;

    const correct = await bcrypt.compare(pin, pinToCheck);

    if (!gallery || !gallery.isPublished || !correct) {
      sendError(res, 'Incorrect PIN', 401);
      return;
    }

    if (gallery.expiresAt && gallery.expiresAt < new Date()) {
      sendError(res, 'This gallery has expired', 403);
      return;
    }

    // Create session
    const sessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + GALLERY_SESSION_TTL_MS);

    const session = await prisma.galleryAccess.create({
      data: { galleryId: gallery.id, sessionTokenHash, expiresAt },
    });

    // Track gallery view
    const ipHash = req.ip ? hashIp(req.ip) : undefined;
    await prisma.galleryView.create({
      data: { galleryId: gallery.id, sessionId: session.id, ipHash },
    });

    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { viewCount: { increment: 1 } },
    });

    res.cookie('gallery_session', sessionToken, GALLERY_COOKIE_OPTIONS);
    sendSuccess(res, { sessionId: session.id }, 'PIN verified successfully');
  } catch (err) {
    next(err);
  }
}

// ─── List gallery photos (requires session) ───────────────────────────────────

export async function listGalleryPhotos(req, res, next) {
  try {
    const { galleryId } = req.gallerySession;
    const { page, limit } = req.query;
    const { page: pageNum, limit: limitNum, skip } = getPagination(page, limit);

    const [galleryPhotos, total] = await Promise.all([
      prisma.galleryPhoto.findMany({
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
      prisma.galleryPhoto.count({ where: { galleryId } }),
    ]);

    const photosWithUrls = await Promise.all(
      galleryPhotos.map(async (gp) => {
        const thumbnailUrl = gp.photo.thumbnailStorageKey
          ? await generateViewPresignedUrl(gp.photo.thumbnailStorageKey, 3600)
          : null;
        const galleryUrl = gp.photo.galleryStorageKey
          ? await generateViewPresignedUrl(gp.photo.galleryStorageKey, 3600)
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
      })
    );

    sendSuccess(res, { photos: photosWithUrls }, undefined, 200, {
      page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Download photo ───────────────────────────────────────────────────────────

export async function downloadPhoto(req, res, next) {
  try {
    const { galleryId, sessionId } = req.gallerySession;
    const { photoId } = req.params;

    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { allowDownloads: true, showWatermark: true },
    });
    if (!gallery?.allowDownloads) {
      sendError(res, 'Downloads are not enabled for this gallery', 403);
      return;
    }

    const galleryPhoto = await prisma.galleryPhoto.findUnique({
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
      sendError(res, 'Photo not found in gallery', 404);
      return;
    }

    const downloadKey = gallery.showWatermark
      ? (galleryPhoto.photo.galleryStorageKey ?? galleryPhoto.photo.storageKey)
      : galleryPhoto.photo.storageKey;

    const signedUrl = await generateDownloadPresignedUrl(downloadKey, galleryPhoto.photo.originalFilename, 600);

    // Track download
    await prisma.photoDownload.create({ data: { galleryId, photoId, sessionId } });
    await prisma.gallery.update({ where: { id: galleryId }, data: { downloadCount: { increment: 1 } } });

    sendSuccess(res, { signedUrl, expiresIn: 600 });
  } catch (err) {
    next(err);
  }
}

// ─── Favorite a photo ─────────────────────────────────────────────────────────

export async function favoritePhoto(req, res, next) {
  try {
    const { galleryId, sessionId } = req.gallerySession;
    const { photoId } = req.params;

    // Verify photo is in gallery
    const galleryPhoto = await prisma.galleryPhoto.findUnique({
      where: { galleryId_photoId: { galleryId, photoId } },
    });
    if (!galleryPhoto) {
      sendError(res, 'Photo not found in gallery', 404);
      return;
    }

    const existing = await prisma.photoFavorite.findUnique({
      where: { galleryId_photoId_sessionId: { galleryId, photoId, sessionId } },
    });

    if (existing) {
      await prisma.photoFavorite.delete({
        where: { galleryId_photoId_sessionId: { galleryId, photoId, sessionId } },
      });
      sendSuccess(res, { favorited: false }, 'Removed from favorites');
    } else {
      await prisma.photoFavorite.create({ data: { galleryId, photoId, sessionId } });
      sendSuccess(res, { favorited: true }, 'Added to favorites');
    }
  } catch (err) {
    next(err);
  }
}

// ─── Get favorites ────────────────────────────────────────────────────────────

export async function listFavorites(req, res, next) {
  try {
    const { galleryId, sessionId } = req.gallerySession;

    const favorites = await prisma.photoFavorite.findMany({
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

    const favoritesWithUrls = await Promise.all(
      favorites.map(async (fav) => {
        const thumbnailUrl = fav.photo.thumbnailStorageKey
          ? await generateViewPresignedUrl(fav.photo.thumbnailStorageKey, 3600)
          : null;
        const galleryUrl = fav.photo.galleryStorageKey
          ? await generateViewPresignedUrl(fav.photo.galleryStorageKey, 3600)
          : null;
        return {
          id: fav.photo.id,
          filename: fav.photo.originalFilename,
          width: fav.photo.width,
          height: fav.photo.height,
          thumbnailUrl,
          galleryUrl,
        };
      })
    );

    sendSuccess(res, { favorites: favoritesWithUrls, count: favoritesWithUrls.length });
  } catch (err) {
    next(err);
  }
}
