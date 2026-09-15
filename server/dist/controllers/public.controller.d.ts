import { Request, Response, NextFunction } from 'express';
import { GallerySessionRequest } from '../types';
export declare function getPublicGallery(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function verifyPin(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function listGalleryPhotos(req: GallerySessionRequest, res: Response, next: NextFunction): Promise<void>;
export declare function downloadPhoto(req: GallerySessionRequest, res: Response, next: NextFunction): Promise<void>;
export declare function favoritePhoto(req: GallerySessionRequest, res: Response, next: NextFunction): Promise<void>;
export declare function listFavorites(req: GallerySessionRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=public.controller.d.ts.map