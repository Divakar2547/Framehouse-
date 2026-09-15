import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function listEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function createEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function getEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function updateEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function deleteEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function listMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function addMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function listTeamMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=event.controller.d.ts.map