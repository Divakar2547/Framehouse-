import { Router } from 'express';
import {
  createGallery,
  listGalleries,
  getGallery,
  updateGallery,
  deleteGallery,
  changePin,
  addPhotosToGallery,
  removePhotoFromGallery,
  reorderGalleryPhotos,
  publishGallery,
  unpublishGallery,
  getGalleryAnalytics,
} from '../controllers/gallery.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createGallerySchema,
  updateGallerySchema,
  changePinSchema,
  reorderPhotosSchema,
} from '../validators/gallery.js';

const router = Router();

router.use(authenticate, requireAdmin);

// Per-event gallery routes
router.post('/events/:id/galleries', validateBody(createGallerySchema), createGallery);
router.get('/events/:id/galleries', listGalleries);

// Per-gallery routes
router.get('/galleries/:id', getGallery);
router.patch('/galleries/:id', validateBody(updateGallerySchema), updateGallery);
router.delete('/galleries/:id', deleteGallery);

// Gallery photos management
router.post('/galleries/:id/photos', addPhotosToGallery);
router.delete('/galleries/:id/photos/:photoId', removePhotoFromGallery);
router.patch('/galleries/:id/photos/reorder', validateBody(reorderPhotosSchema), reorderGalleryPhotos);

// Gallery lifecycle
router.post('/galleries/:id/publish', publishGallery);
router.post('/galleries/:id/unpublish', unpublishGallery);
router.post('/galleries/:id/pin', validateBody(changePinSchema), changePin);

// Analytics
router.get('/galleries/:id/analytics', getGalleryAnalytics);

export default router;
