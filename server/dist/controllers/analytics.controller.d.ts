import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function getDashboardAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getEventAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=analytics.controller.d.ts.map