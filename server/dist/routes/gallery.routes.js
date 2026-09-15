"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gallery_controller_1 = require("../controllers/gallery.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const gallery_1 = require("../validators/gallery");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireAdmin);
// Per-event gallery routes
router.post('/events/:id/galleries', (0, validate_1.validateBody)(gallery_1.createGallerySchema), gallery_controller_1.createGallery);
router.get('/events/:id/galleries', gallery_controller_1.listGalleries);
// Per-gallery routes
router.get('/galleries/:id', gallery_controller_1.getGallery);
router.patch('/galleries/:id', (0, validate_1.validateBody)(gallery_1.updateGallerySchema), gallery_controller_1.updateGallery);
router.delete('/galleries/:id', gallery_controller_1.deleteGallery);
// Gallery photos management
router.post('/galleries/:id/photos', gallery_controller_1.addPhotosToGallery);
router.delete('/galleries/:id/photos/:photoId', gallery_controller_1.removePhotoFromGallery);
router.patch('/galleries/:id/photos/reorder', (0, validate_1.validateBody)(gallery_1.reorderPhotosSchema), gallery_controller_1.reorderGalleryPhotos);
// Gallery lifecycle
router.post('/galleries/:id/publish', gallery_controller_1.publishGallery);
router.post('/galleries/:id/unpublish', gallery_controller_1.unpublishGallery);
router.post('/galleries/:id/pin', (0, validate_1.validateBody)(gallery_1.changePinSchema), gallery_controller_1.changePin);
// Analytics
router.get('/galleries/:id/analytics', gallery_controller_1.getGalleryAnalytics);
exports.default = router;
//# sourceMappingURL=gallery.routes.js.map