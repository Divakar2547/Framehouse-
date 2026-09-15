import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function markNotificationRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function markAllRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=notification.controller.d.ts.map