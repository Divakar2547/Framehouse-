"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAndUploadVariants = processAndUploadVariants;
exports.validateImageBuffer = validateImageBuffer;
const s3_service_1 = require("./s3.service");
// Keep image processing available even when Sharp's optional type declarations
// are unavailable in a partially installed local dependency tree.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');
const THUMBNAIL_SIZE = 400;
const MEDIUM_SIZE = 1000;
const GALLERY_SIZE = 1600;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 82;
/**
 * Download original from S3 (or accept a buffer) and produce
 * thumbnail, medium, and gallery variants, then upload all back to S3.
 */
async function processAndUploadVariants(originalBuffer, eventId, photoId, originalFilename, watermark) {
    const image = sharp(originalBuffer, { failOnError: false });
    const metadata = await image.metadata();
    const ext = 'jpg';
    const baseName = `${photoId}`;
    const thumbnailKey = `events/${eventId}/thumbnails/${baseName}.${ext}`;
    const mediumKey = `events/${eventId}/medium/${baseName}.${ext}`;
    const galleryKey = `events/${eventId}/gallery/${baseName}.${ext}`;
    // Thumbnail — 400px wide, cropped to cover square
    const thumbnailBuffer = await sharp(originalBuffer, { failOnError: false })
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'center' })
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toBuffer();
    // Medium — 1000px max dimension
    const mediumBuffer = await sharp(originalBuffer, { failOnError: false })
        .resize(MEDIUM_SIZE, MEDIUM_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toBuffer();
    // Gallery — 1600px max dimension, optionally watermarked
    let galleryPipeline = sharp(originalBuffer, { failOnError: false })
        .resize(GALLERY_SIZE, GALLERY_SIZE, { fit: 'inside', withoutEnlargement: true });
    if (watermark) {
        const resizedMeta = await galleryPipeline.clone().metadata();
        const imgWidth = resizedMeta.width ?? GALLERY_SIZE;
        const fontSize = Math.max(24, Math.floor(imgWidth * 0.03));
        const svgWatermark = `
      <svg width="${imgWidth}" height="${Math.floor(fontSize * 2)}">
        <style>
          .watermark {
            font-family: sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(255,255,255,0.6);
            font-weight: bold;
          }
        </style>
        <text
          x="${imgWidth / 2}"
          y="${Math.floor(fontSize * 1.5)}"
          text-anchor="middle"
          class="watermark"
        >${watermark.text}</text>
      </svg>
    `;
        const svgBuffer = Buffer.from(svgWatermark);
        galleryPipeline = sharp(originalBuffer, { failOnError: false })
            .resize(GALLERY_SIZE, GALLERY_SIZE, { fit: 'inside', withoutEnlargement: true })
            .composite([{
                input: svgBuffer,
                gravity: 'south',
            }]);
    }
    const galleryBuffer = await galleryPipeline
        .jpeg({ quality: JPEG_QUALITY, progressive: true })
        .toBuffer();
    // Upload all variants in parallel
    await Promise.all([
        (0, s3_service_1.uploadBuffer)(thumbnailKey, thumbnailBuffer, 'image/jpeg'),
        (0, s3_service_1.uploadBuffer)(mediumKey, mediumBuffer, 'image/jpeg'),
        (0, s3_service_1.uploadBuffer)(galleryKey, galleryBuffer, 'image/jpeg'),
    ]);
    return {
        thumbnailKey,
        galleryKey,
        mediumKey,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
    };
}
/**
 * Validate that a buffer is a real image.
 */
async function validateImageBuffer(buffer) {
    try {
        const metadata = await sharp(buffer).metadata();
        const allowedFormats = ['jpeg', 'png', 'webp', 'heif', 'avif'];
        if (!metadata.format || !allowedFormats.includes(metadata.format)) {
            return { valid: false };
        }
        return {
            valid: true,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
        };
    }
    catch {
        return { valid: false };
    }
}
//# sourceMappingURL=image.service.js.map