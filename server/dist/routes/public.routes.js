"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const public_controller_1 = require("../controllers/public.controller");
const gallerySession_1 = require("../middleware/gallerySession");
const validate_1 = require("../middleware/validate");
const gallery_1 = require("../validators/gallery");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Public — no session required
router.get('/:slug', public_controller_1.getPublicGallery);
router.post('/:slug/verify-pin', rateLimiter_1.pinRateLimiter, (0, validate_1.validateBody)(gallery_1.verifyPinSchema), public_controller_1.verifyPin);
// Requires valid gallery session cookie
router.get('/:slug/photos', gallerySession_1.requireGallerySession, public_controller_1.listGalleryPhotos);
router.post('/:slug/photos/:photoId/download', rateLimiter_1.downloadRateLimiter, gallerySession_1.requireGallerySession, public_controller_1.downloadPhoto);
router.post('/:slug/photos/:photoId/favorite', gallerySession_1.requireGallerySession, public_controller_1.favoritePhoto);
router.get('/:slug/favorites', gallerySession_1.requireGallerySession, public_controller_1.listFavorites);
exports.default = router;
//# sourceMappingURL=public.routes.js.map