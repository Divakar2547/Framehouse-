import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function getUploadUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function completeUpload(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function listPhotos(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function updatePhotoSelection(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function bulkSelectPhotos(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function deletePhoto(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getSignedUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=photo.controller.d.ts.map