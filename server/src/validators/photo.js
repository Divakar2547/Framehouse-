import { z } from 'zod';

export const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]),
  fileSize: z.number().int().positive(),
  checksum: z.string().min(1),
  uploadBatchId: z.string().optional(),
});

export const completeUploadSchema = z.object({
  photoId: z.string().min(1),
  checksum: z.string().min(1),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const bulkSelectSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(500),
  isSelected: z.boolean(),
});

export const photoFilterSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED']).optional(),
  isSelected: z.enum(['true', 'false']).optional(),
  uploadedById: z.string().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'filename', 'fileSize']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
