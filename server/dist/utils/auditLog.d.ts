import { AuditAction } from '@prisma/client';
interface AuditLogParams {
    userId?: string;
    eventId?: string;
    action: AuditAction;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}
export declare function createAuditLog(params: AuditLogParams): Promise<void>;
export {};
//# sourceMappingURL=auditLog.d.ts.map