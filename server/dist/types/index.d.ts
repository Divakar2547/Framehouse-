import { Request } from 'express';
import { Role } from '@prisma/client';
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: Role;
}
export interface AuthRequest extends Request {
    user?: AuthUser;
}
export interface GallerySessionRequest extends Request {
    gallerySession?: {
        sessionId: string;
        galleryId: string;
    };
}
export interface PaginationQuery {
    page?: string;
    limit?: string;
}
export interface PhotoFilterQuery extends PaginationQuery {
    status?: string;
    isSelected?: string;
    uploadedById?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface UploadCompletionPayload {
    photoId: string;
    checksum: string;
    fileSize: number;
    width?: number;
    height?: number;
}
export interface JwtPayload {
    userId: string;
    email: string;
    role: Role;
    iat?: number;
    exp?: number;
}
//# sourceMappingURL=index.d.ts.map