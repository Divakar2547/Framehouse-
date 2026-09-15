import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireTeamOrAdmin(req: AuthRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map