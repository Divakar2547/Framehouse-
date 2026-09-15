import sharp from 'sharp';
import { uploadBuffer } from './s3.service.js';

const THUMBNAIL_SIZE = 400;
const MEDIUM_SIZE = 1000;
const GALLERY_SIZE = 1600;
const JPEG_QUALITY = 85;

/**
 * Download original from S3 (or accept a buffer) and produce
 * thumbnail, medium, and gallery variants, then upload all back to S3.
 */
export async function processAndUploadVariants(
  originalBuffer,
  eventId,
  photoId,
  originalFilename,
  watermark
) {
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
  const resizedGalleryBuffer = await sharp(originalBuffer, { failOnError: false })
    .resize(GALLERY_SIZE, GALLERY_SIZE, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  let galleryBuffer;
  if (watermark && watermark.text) {
    const galleryMeta = await sharp(resizedGalleryBuffer).metadata();
    const imgWidth = galleryMeta.width ?? GALLERY_SIZE;
    const fontSize = Math.max(20, Math.floor(imgWidth * 0.03));
    const textEscaped = String(watermark.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svgWatermark = `
      <svg width="${imgWidth}" height="${Math.floor(fontSize * 2.5)}">
        <style>
          .watermark {
            font-family: sans-serif;
            font-size: ${fontSize}px;
            fill: rgba(255,255,255,0.65);
            font-weight: bold;
          }
        </style>
        <text
          x="${imgWidth / 2}"
          y="${Math.floor(fontSize * 1.8)}"
          text-anchor="middle"
          class="watermark"
        >${textEscaped}</text>
      </svg>
    `;

    const svgBuffer = Buffer.from(svgWatermark);
    galleryBuffer = await sharp(resizedGalleryBuffer, { failOnError: false })
      .composite([{
        input: svgBuffer,
        gravity: 'south',
      }])
      .jpeg({ quality: JPEG_QUALITY, progressive: true })
      .toBuffer();
  } else {
    galleryBuffer = await sharp(resizedGalleryBuffer, { failOnError: false })
      .jpeg({ quality: JPEG_QUALITY, progressive: true })
      .toBuffer();
  }

  // Upload all variants in parallel
  await Promise.all([
    uploadBuffer(thumbnailKey, thumbnailBuffer, 'image/jpeg'),
    uploadBuffer(mediumKey, mediumBuffer, 'image/jpeg'),
    uploadBuffer(galleryKey, galleryBuffer, 'image/jpeg'),
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
export async function validateImageBuffer(buffer) {
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
  } catch {
    return { valid: false };
  }
}
