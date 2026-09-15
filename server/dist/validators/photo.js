"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoFilterSchema = exports.bulkSelectSchema = exports.completeUploadSchema = exports.uploadUrlSchema = void 0;
const zod_1 = require("zod");
exports.uploadUrlSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1).max(255),
    mimeType: zod_1.z.enum([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
    ]),
    fileSize: zod_1.z.number().int().positive(),
    checksum: zod_1.z.string().min(1),
    uploadBatchId: zod_1.z.string().optional(),
});
exports.completeUploadSchema = zod_1.z.object({
    photoId: zod_1.z.string().cuid(),
    checksum: zod_1.z.string().min(1),
    fileSize: zod_1.z.number().int().positive(),
    width: zod_1.z.number().int().positive().optional(),
    height: zod_1.z.number().int().positive().optional(),
});
exports.bulkSelectSchema = zod_1.z.object({
    photoIds: zod_1.z.array(zod_1.z.string().cuid()).min(1).max(500),
    isSelected: zod_1.z.boolean(),
});
exports.photoFilterSchema = zod_1.z.object({
    page: zod_1.z.string().optional(),
    limit: zod_1.z.string().optional(),
    status: zod_1.z.enum(['UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED']).optional(),
    isSelected: zod_1.z.enum(['true', 'false']).optional(),
    uploadedById: zod_1.z.string().optional(),
    search: zod_1.z.string().max(100).optional(),
    sortBy: zod_1.z.enum(['createdAt', 'filename', 'fileSize']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
//# sourceMappingURL=photo.js.map