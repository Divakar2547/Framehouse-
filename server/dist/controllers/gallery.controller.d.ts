import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function createGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function listGalleries(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function updateGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function changePin(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function addPhotosToGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function removePhotoFromGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function reorderGalleryPhotos(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function publishGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function unpublishGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getGalleryAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function deleteGallery(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=gallery.controller.d.ts.map