import { Router } from 'express';
import {
  getPublicGallery,
  verifyPin,
  listGalleryPhotos,
  downloadPhoto,
  favoritePhoto,
  listFavorites,
} from '../controllers/public.controller.js';
import { requireGallerySession } from '../middleware/gallerySession.js';
import { validateBody } from '../middleware/validate.js';
import { verifyPinSchema } from '../validators/gallery.js';
import { pinRateLimiter, downloadRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public — no session required
router.get('/:slug', getPublicGallery);
router.post('/:slug/verify-pin', pinRateLimiter, validateBody(verifyPinSchema), verifyPin);

// Requires valid gallery session cookie
router.get('/:slug/photos', requireGallerySession, listGalleryPhotos);
router.post('/:slug/photos/:photoId/download', downloadRateLimiter, requireGallerySession, downloadPhoto);
router.post('/:slug/photos/:photoId/favorite', requireGallerySession, favoritePhoto);
router.get('/:slug/favorites', requireGallerySession, listFavorites);

export default router;
