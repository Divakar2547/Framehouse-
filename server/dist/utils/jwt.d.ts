import { JwtPayload } from '../types';
import { Role } from '@prisma/client';
export declare function signToken(payload: {
    userId: string;
    email: string;
    role: Role;
}): string;
export declare function verifyToken(token: string): JwtPayload;
export declare function decodeToken(token: string): JwtPayload | null;
//# sourceMappingURL=jwt.d.ts.map