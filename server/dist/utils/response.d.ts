import { Response } from 'express';
import { ApiResponse } from '../types';
export declare function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number, pagination?: ApiResponse['pagination']): Response;
export declare function sendError(res: Response, message: string, statusCode?: number, error?: string): Response;
export declare function getPagination(page: string | undefined, limit: string | undefined): {
    page: number;
    limit: number;
    skip: number;
};
//# sourceMappingURL=response.d.ts.map