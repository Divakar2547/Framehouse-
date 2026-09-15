import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function register(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function login(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map