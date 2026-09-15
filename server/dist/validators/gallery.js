"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPinSchema = exports.reorderPhotosSchema = exports.changePinSchema = exports.updateGallerySchema = exports.createGallerySchema = void 0;
const zod_1 = require("zod");
exports.createGallerySchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(200),
    description: zod_1.z.string().max(2000).optional(),
    pin: zod_1.z
        .string()
        .length(6, 'PIN must be exactly 6 digits')
        .regex(/^\d{6}$/, 'PIN must contain only digits'),
    allowDownloads: zod_1.z.boolean().optional().default(false),
    showWatermark: zod_1.z.boolean().optional().default(false),
    watermarkText: zod_1.z.string().max(100).optional(),
    expiresAt: zod_1.z.string().datetime().optional().nullable(),
});
exports.updateGallerySchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(200).optional(),
    description: zod_1.z.string().max(2000).optional(),
    allowDownloads: zod_1.z.boolean().optional(),
    showWatermark: zod_1.z.boolean().optional(),
    watermarkText: zod_1.z.string().max(100).optional(),
    expiresAt: zod_1.z.string().datetime().optional().nullable(),
});
exports.changePinSchema = zod_1.z.object({
    pin: zod_1.z
        .string()
        .length(6, 'PIN must be exactly 6 digits')
        .regex(/^\d{6}$/, 'PIN must contain only digits'),
});
exports.reorderPhotosSchema = zod_1.z.object({
    photoOrders: zod_1.z.array(zod_1.z.object({
        galleryPhotoId: zod_1.z.string(),
        sortOrder: zod_1.z.number().int().min(0),
    })),
});
exports.verifyPinSchema = zod_1.z.object({
    pin: zod_1.z
        .string()
        .length(6, 'PIN must be exactly 6 digits')
        .regex(/^\d{6}$/, 'PIN must contain only digits'),
});
//# sourceMappingURL=gallery.js.map