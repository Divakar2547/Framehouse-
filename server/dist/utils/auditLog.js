"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
const prisma_1 = __importDefault(require("../config/prisma"));
async function createAuditLog(params) {
    try {
        await prisma_1.default.auditLog.create({
            data: {
                userId: params.userId,
                eventId: params.eventId,
                action: params.action,
                details: (params.details ?? {}),
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            },
        });
    }
    catch (err) {
        // Audit log failure should never crash the main request
        console.error('Audit log error:', err);
    }
}
//# sourceMappingURL=auditLog.js.map