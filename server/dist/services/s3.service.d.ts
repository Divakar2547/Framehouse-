/**
 * Generate a presigned PUT URL so the client can upload directly to S3.
 * The presigned URL expires in 15 minutes.
 */
export declare function generateUploadPresignedUrl(key: string, mimeType: string, expiresIn?: number): Promise<string>;
/**
 * Generate a short-lived presigned GET URL for downloading a photo.
 * Default expiry: 10 minutes.
 */
export declare function generateDownloadPresignedUrl(key: string, originalFilename: string, expiresIn?: number): Promise<string>;
/**
 * Generate a short-lived presigned GET URL for viewing (inline) a photo.
 * Default expiry: 60 minutes (gallery thumbnail/view).
 */
export declare function generateViewPresignedUrl(key: string, expiresIn?: number): Promise<string>;
/**
 * Upload a buffer directly from the server (used for processed images).
 */
export declare function uploadBuffer(key: string, buffer: Buffer, mimeType: string, metadata?: Record<string, string>): Promise<void>;
/**
 * Delete a single object from S3.
 */
export declare function deleteObject(key: string): Promise<void>;
/**
 * Delete multiple objects from S3.
 */
export declare function deleteObjects(keys: string[]): Promise<void>;
/**
 * Check whether an object exists in S3.
 */
export declare function objectExists(key: string): Promise<boolean>;
/**
 * Build the S3 storage key for a photo variant.
 */
export declare function buildStorageKey(eventId: string, photoId: string, variant: 'originals' | 'gallery' | 'thumbnails' | 'medium', filename: string): string;
//# sourceMappingURL=s3.service.d.ts.map