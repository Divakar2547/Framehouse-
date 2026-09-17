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

// Ensure local storage directory exists in development/test
if (!env.isProduction && !fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function assertLocalStorageAllowed() {
  if (env.isProduction) {
    throw new Error('Local disk storage fallback is forbidden in production. AWS S3 must be configured.');
  }
}

function getLocalFilePath(key) {
  const cleanKey = key.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '');
  return path.join(STORAGE_DIR, cleanKey);
}

// In-memory + persistent disk storage (development/test only)
export const mockStorage = {
  has(key) {
    assertLocalStorageAllowed();
    return fs.existsSync(getLocalFilePath(key));
  },
  get(key) {
    assertLocalStorageAllowed();
    const filePath = getLocalFilePath(key);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  },
  set(key, buffer) {
    assertLocalStorageAllowed();
    const filePath = getLocalFilePath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  },
  delete(key) {
    assertLocalStorageAllowed();
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
    assertLocalStorageAllowed();
    if (mockStorage.has(key)) {
      return mockStorage.get(key);
    }
    // Generate a neutral placeholder JPEG if mock storage doesn't have it on disk
    return sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 35, g: 39, b: 47 },
      },
    })
      .jpeg()
      .toBuffer();
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
