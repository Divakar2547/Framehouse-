"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadPresignedUrl = generateUploadPresignedUrl;
exports.generateDownloadPresignedUrl = generateDownloadPresignedUrl;
exports.generateViewPresignedUrl = generateViewPresignedUrl;
exports.uploadBuffer = uploadBuffer;
exports.deleteObject = deleteObject;
exports.deleteObjects = deleteObjects;
exports.objectExists = objectExists;
exports.buildStorageKey = buildStorageKey;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("../config/env");
const s3Client = new client_s3_1.S3Client({
    region: env_1.env.AWS_REGION,
    ...(env_1.env.AWS_ACCESS_KEY_ID && env_1.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
            },
        }
        : {}),
});
const BUCKET = env_1.env.AWS_S3_BUCKET;
const sendS3Command = (command) => s3Client.send(command);
/**
 * Generate a presigned PUT URL so the client can upload directly to S3.
 * The presigned URL expires in 15 minutes.
 */
async function generateUploadPresignedUrl(key, mimeType, expiresIn = 900) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: mimeType,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
}
/**
 * Generate a short-lived presigned GET URL for downloading a photo.
 * Default expiry: 10 minutes.
 */
async function generateDownloadPresignedUrl(key, originalFilename, expiresIn = 600) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
}
/**
 * Generate a short-lived presigned GET URL for viewing (inline) a photo.
 * Default expiry: 60 minutes (gallery thumbnail/view).
 */
async function generateViewPresignedUrl(key, expiresIn = 3600) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
}
/**
 * Upload a buffer directly from the server (used for processed images).
 */
async function uploadBuffer(key, buffer, mimeType, metadata) {
    const command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: metadata,
    });
    await sendS3Command(command);
}
/**
 * Delete a single object from S3.
 */
async function deleteObject(key) {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    await sendS3Command(command);
}
/**
 * Delete multiple objects from S3.
 */
async function deleteObjects(keys) {
    if (keys.length === 0)
        return;
    // S3 delete objects supports max 1000 per request
    const chunks = [];
    for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(keys.slice(i, i + 1000));
    }
    for (const chunk of chunks) {
        const command = new client_s3_1.DeleteObjectsCommand({
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
 * Check whether an object exists in S3.
 */
async function objectExists(key) {
    try {
        const command = new client_s3_1.HeadObjectCommand({ Bucket: BUCKET, Key: key });
        await sendS3Command(command);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Build the S3 storage key for a photo variant.
 */
function buildStorageKey(eventId, photoId, variant, filename) {
    return `events/${eventId}/${variant}/${photoId}/${filename}`;
}
//# sourceMappingURL=s3.service.js.map