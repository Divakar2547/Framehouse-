import { z } from 'zod';

export const createGallerySchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  pin: z
    .string()
    .length(6, 'PIN must be exactly 6 digits')
    .regex(/^\d{6}$/, 'PIN must contain only digits'),
  allowDownloads: z.boolean().optional().default(false),
  showWatermark: z.boolean().optional().default(false),
  watermarkText: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const updateGallerySchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  allowDownloads: z.boolean().optional(),
  showWatermark: z.boolean().optional(),
  watermarkText: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const changePinSchema = z.object({
  pin: z
    .string()
    .length(6, 'PIN must be exactly 6 digits')
    .regex(/^\d{6}$/, 'PIN must contain only digits'),
});

export const reorderPhotosSchema = z.object({
  photoOrders: z.array(
    z.object({
      galleryPhotoId: z.string(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export const verifyPinSchema = z.object({
  pin: z
    .string()
    .length(6, 'PIN must be exactly 6 digits')
    .regex(/^\d{6}$/, 'PIN must contain only digits'),
});
