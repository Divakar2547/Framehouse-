export interface ProcessedImageResult {
    thumbnailKey: string;
    galleryKey: string;
    mediumKey: string;
    width: number;
    height: number;
}
export interface WatermarkOptions {
    text: string;
}
/**
 * Download original from S3 (or accept a buffer) and produce
 * thumbnail, medium, and gallery variants, then upload all back to S3.
 */
export declare function processAndUploadVariants(originalBuffer: Buffer, eventId: string, photoId: string, originalFilename: string, watermark?: WatermarkOptions): Promise<ProcessedImageResult>;
/**
 * Validate that a buffer is a real image.
 */
export declare function validateImageBuffer(buffer: Buffer): Promise<{
    valid: boolean;
    width?: number;
    height?: number;
    format?: string;
}>;
//# sourceMappingURL=image.service.d.ts.map