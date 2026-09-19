import fs from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { env } from '../config/env.js';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');

// Ensure local storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch {}
}

function getLocalFilePath(key) {
  const cleanKey = key.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '');
  return path.join(STORAGE_DIR, cleanKey);
}

// In-memory + persistent disk storage fallback
export const mockStorage = {
  has(key) {
    return fs.existsSync(getLocalFilePath(key));
  },
  get(key) {
    const filePath = getLocalFilePath(key);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  },
  set(key, buffer) {
    const filePath = getLocalFilePath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  },
  delete(key) {
    const filePath = getLocalFilePath(key);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  },
  clear() {}
};

const s3Client = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

const BUCKET = env.AWS_S3_BUCKET;
const sendS3Command = (command) => s3Client.send(command);

/**
 * Generate a presigned PUT URL so the client can upload directly to S3 or local server.
 * The presigned URL expires in 15 minutes.
 */
export async function generateUploadPresignedUrl(
  key,
  mimeType,
  expiresIn = 900
) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    return `${env.SERVER_URL || 'http://localhost:5000'}/api/mock-upload/${encodeURIComponent(key)}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a short-lived presigned GET URL for downloading a photo.
 * Default expiry: 10 minutes.
 */
export async function generateDownloadPresignedUrl(
  key,
  originalFilename,
  expiresIn = 600
) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    return `${env.SERVER_URL || 'http://localhost:5000'}/api/mock-view/${encodeURIComponent(key)}?download=1&filename=${encodeURIComponent(originalFilename || 'photo.jpg')}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a short-lived presigned GET URL for viewing (inline) a photo.
 * Default expiry: 60 minutes (gallery thumbnail/view).
 */
export async function generateViewPresignedUrl(
  key,
  expiresIn = 3600
) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    return `${env.SERVER_URL || 'http://localhost:5000'}/api/mock-view/${encodeURIComponent(key)}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Fetch the object binary as a Buffer from S3 or local disk storage.
 */
export async function getObjectBuffer(key) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    if (mockStorage.has(key)) {
      return mockStorage.get(key);
    }
    
    // Parse key to customize style
    const isThumb = key.includes('thumbnails');
    const width = isThumb ? 400 : 1200;
    const height = isThumb ? 400 : 800;
    
    // Dynamic color accents based on key hash
    const colors = [
      ['#3b0764', '#7e22ce', '#c084fc'], // Purple
      ['#0f172a', '#0369a1', '#38bdf8'], // Blue
      ['#14532d', '#15803d', '#4ade80'], // Emerald
      ['#7c2d12', '#c2410c', '#fb923c'], // Sunset Orange
      ['#831843', '#be185d', '#f472b6'], // Rose
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % colors.length;
    const palette = colors[Math.abs(hash)];

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${palette[0]}" />
            <stop offset="50%" stop-color="${palette[1]}" />
            <stop offset="100%" stop-color="${palette[2]}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
        <circle cx="${width * 0.8}" cy="${height * 0.2}" r="${height * 0.3}" fill="#ffffff" fill-opacity="0.08" />
        <circle cx="${width * 0.2}" cy="${height * 0.8}" r="${height * 0.35}" fill="#ffffff" fill-opacity="0.05" />
        <rect x="${width * 0.1}" y="${height * 0.15}" width="${width * 0.8}" height="${height * 0.7}" rx="16" fill="#ffffff" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2" />
        <text x="${width * 0.5}" y="${height * 0.48}" font-family="system-ui, -apple-system, sans-serif" font-size="${isThumb ? '18' : '32'}" font-weight="700" fill="#ffffff" text-anchor="middle">Framehouse</text>
        <text x="${width * 0.5}" y="${height * 0.6}" font-family="system-ui, -apple-system, sans-serif" font-size="${isThumb ? '12' : '18'}" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">High Resolution Photo</text>
      </svg>
    `;

    return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await sendS3Command(command);
  const stream = response.Body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Upload a buffer directly from the server (used for processed images).
 */
export async function uploadBuffer(
  key,
  buffer,
  mimeType,
  metadata
) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    mockStorage.set(key, buffer);
    return;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
  });

  await sendS3Command(command);
}

/**
 * Delete a single object from S3 or local disk.
 */
export async function deleteObject(key) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    mockStorage.delete(key);
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await sendS3Command(command);
}

/**
 * Delete multiple objects from S3 or local disk.
 */
export async function deleteObjects(keys) {
  if (keys.length === 0) return;

  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    for (const k of keys) mockStorage.delete(k);
    return;
  }

  // S3 delete objects supports max 1000 per request
  const chunks = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }

  for (const chunk of chunks) {
    const command = new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: {
        Objects: chunk.map(key => ({ Key: key })),
        Quiet: true,
      },
    });

    await sendS3Command(command);
  }
}

/**
 * Check whether an object exists in S3 or local disk.
 */
export async function objectExists(key) {
  if (!BUCKET || !env.AWS_ACCESS_KEY_ID) {
    assertLocalStorageAllowed();
    return mockStorage.has(key);
  }

  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
    await sendS3Command(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the S3 storage key for a photo variant.
 */
export function buildStorageKey(
  eventId,
  photoId,
  variant,
  filename
) {
  return `events/${eventId}/${variant}/${photoId}/${filename}`;
}
