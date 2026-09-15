import { Router } from 'express';
import {
  getUploadUrl,
  completeUpload,
  listPhotos,
  updatePhotoSelection,
  bulkSelectPhotos,
  deletePhoto,
  getSignedUrl,
} from '../controllers/photo.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { uploadUrlSchema, completeUploadSchema, bulkSelectSchema } from '../validators/photo.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(authenticate);

// Per-event photo routes
router.get('/events/:id/photos', listPhotos);
router.post('/events/:id/photos/upload-url', uploadRateLimiter, validateBody(uploadUrlSchema), getUploadUrl);
router.post('/events/:id/photos/complete', validateBody(completeUploadSchema), completeUpload);
router.post('/events/:id/photos/bulk-select', requireAdmin, validateBody(bulkSelectSchema), bulkSelectPhotos);

// Per-photo routes
router.patch('/photos/:id/selection', requireAdmin, updatePhotoSelection);
router.delete('/photos/:id', deletePhoto);
router.get('/photos/:id/signed-url', getSignedUrl);

export default router;
