import prisma from '../config/prisma.js';

export async function createAuditLog(params) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        eventId: params.eventId,
        action: params.action,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
