"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const photo_controller_1 = require("../controllers/photo.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const photo_1 = require("../validators/photo");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Per-event photo routes
router.get('/events/:id/photos', photo_controller_1.listPhotos);
router.post('/events/:id/photos/upload-url', rateLimiter_1.uploadRateLimiter, (0, validate_1.validateBody)(photo_1.uploadUrlSchema), photo_controller_1.getUploadUrl);
router.post('/events/:id/photos/complete', (0, validate_1.validateBody)(photo_1.completeUploadSchema), photo_controller_1.completeUpload);
router.post('/events/:id/photos/bulk-select', auth_1.requireAdmin, (0, validate_1.validateBody)(photo_1.bulkSelectSchema), photo_controller_1.bulkSelectPhotos);
// Per-photo routes
router.patch('/photos/:id/selection', auth_1.requireAdmin, photo_controller_1.updatePhotoSelection);
router.delete('/photos/:id', photo_controller_1.deletePhoto);
router.get('/photos/:id/signed-url', photo_controller_1.getSignedUrl);
exports.default = router;
//# sourceMappingURL=photo.routes.js.map