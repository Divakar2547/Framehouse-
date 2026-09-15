"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = listEvents;
exports.createEvent = createEvent;
exports.getEvent = getEvent;
exports.updateEvent = updateEvent;
exports.deleteEvent = deleteEvent;
exports.listMembers = listMembers;
exports.addMember = addMember;
exports.removeMember = removeMember;
exports.listTeamMembers = listTeamMembers;
const response_1 = require("../utils/response");
const auditLog_1 = require("../utils/auditLog");
const prisma_1 = __importDefault(require("../config/prisma"));
// ─── List events ──────────────────────────────────────────────────────────────
async function listEvents(req, res, next) {
    try {
        const user = req.user;
        const { page, limit, status, search } = req.query;
        const { page: pageNum, limit: limitNum, skip } = (0, response_1.getPagination)(page, limit);
        const where = user.role === 'ADMIN'
            ? {
                ownerId: user.id,
                ...(status ? { status: status } : {}),
                ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            }
            : {
                members: { some: { userId: user.id } },
                ...(status ? { status: status } : {}),
                ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            };
        const [events, total] = await Promise.all([
            prisma_1.default.event.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { eventDate: 'desc' },
                include: {
                    _count: { select: { photos: true, members: true, galleries: true } },
                    owner: { select: { id: true, name: true, email: true } },
                    galleries: {
                        select: { id: true, isPublished: true, status: true },
                        take: 1,
                    },
                },
            }),
            prisma_1.default.event.count({ where }),
        ]);
        (0, response_1.sendSuccess)(res, { events }, undefined, 200, {
            page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Create event ─────────────────────────────────────────────────────────────
async function createEvent(req, res, next) {
    try {
        const user = req.user;
        const data = req.body;
        const event = await prisma_1.default.event.create({
            data: {
                name: data.name,
                description: data.description,
                eventDate: new Date(data.eventDate),
                location: data.location,
                status: data.status ?? 'UPCOMING',
                ownerId: user.id,
            },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id,
            eventId: event.id,
            action: 'EVENT_CREATED',
            details: { eventName: event.name },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        (0, response_1.sendSuccess)(res, { event }, 'Event created', 201);
    }
    catch (err) {
        next(err);
    }
}
// ─── Get event ────────────────────────────────────────────────────────────────
async function getEvent(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const event = await prisma_1.default.event.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
                    },
                },
                _count: { select: { photos: true } },
                galleries: {
                    select: { id: true, title: true, slug: true, isPublished: true, status: true, viewCount: true },
                },
            },
        });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        // Authorization: admin sees only their own; team sees only assigned
        if (user.role === 'ADMIN' && event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        if (user.role === 'TEAM_MEMBER') {
            const isMember = event.members.some(m => m.userId === user.id);
            if (!isMember) {
                (0, response_1.sendError)(res, 'Access denied', 403);
                return;
            }
        }
        // Aggregate stats
        const [photoStats, storageStats] = await Promise.all([
            prisma_1.default.photo.groupBy({
                by: ['status', 'isSelected'],
                where: { eventId: id, status: { not: 'DELETED' } },
                _count: true,
            }),
            prisma_1.default.photo.aggregate({
                where: { eventId: id, status: { not: 'DELETED' } },
                _sum: { fileSize: true },
                _count: true,
            }),
        ]);
        (0, response_1.sendSuccess)(res, { event, photoStats, storageStats });
    }
    catch (err) {
        next(err);
    }
}
// ─── Update event ─────────────────────────────────────────────────────────────
async function updateEvent(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const data = req.body;
        const event = await prisma_1.default.event.findUnique({ where: { id }, select: { ownerId: true } });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        if (event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        const updated = await prisma_1.default.event.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.eventDate && { eventDate: new Date(data.eventDate) }),
                ...(data.location !== undefined && { location: data.location }),
                ...(data.status && { status: data.status }),
            },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: id, action: 'EVENT_UPDATED',
            details: { changes: data }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { event: updated }, 'Event updated');
    }
    catch (err) {
        next(err);
    }
}
// ─── Delete event ─────────────────────────────────────────────────────────────
async function deleteEvent(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const event = await prisma_1.default.event.findUnique({ where: { id }, select: { ownerId: true, name: true } });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        if (event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        await prisma_1.default.event.delete({ where: { id } });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, action: 'EVENT_DELETED',
            details: { eventName: event.name, eventId: id }, ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, null, 'Event deleted');
    }
    catch (err) {
        next(err);
    }
}
// ─── Event Members ────────────────────────────────────────────────────────────
async function listMembers(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const event = await prisma_1.default.event.findUnique({ where: { id }, select: { ownerId: true } });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        if (event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        const members = await prisma_1.default.eventMember.findMany({
            where: { eventId: id },
            include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true, isActive: true } },
            },
            orderBy: { assignedAt: 'asc' },
        });
        (0, response_1.sendSuccess)(res, { members });
    }
    catch (err) {
        next(err);
    }
}
async function addMember(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const { userId } = req.body;
        const event = await prisma_1.default.event.findUnique({ where: { id }, select: { ownerId: true, name: true } });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        if (event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true, isActive: true },
        });
        if (!targetUser) {
            (0, response_1.sendError)(res, 'User not found', 404);
            return;
        }
        if (!targetUser.isActive) {
            (0, response_1.sendError)(res, 'User account is deactivated', 400);
            return;
        }
        if (targetUser.role !== 'TEAM_MEMBER') {
            (0, response_1.sendError)(res, 'Only team members can be added to events', 400);
            return;
        }
        const existing = await prisma_1.default.eventMember.findUnique({
            where: { eventId_userId: { eventId: id, userId } },
        });
        if (existing) {
            (0, response_1.sendError)(res, 'User is already a member of this event', 409);
            return;
        }
        const member = await prisma_1.default.eventMember.create({
            data: { eventId: id, userId },
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        });
        // Notify the team member
        await prisma_1.default.notification.create({
            data: {
                userId,
                title: 'Added to Event',
                message: `You have been added to the event "${event.name}".`,
                type: 'event',
            },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: id, action: 'MEMBER_ADDED',
            details: { memberEmail: targetUser.email, memberName: targetUser.name },
            ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, { member }, 'Team member added', 201);
    }
    catch (err) {
        next(err);
    }
}
async function removeMember(req, res, next) {
    try {
        const user = req.user;
        const { id, userId } = req.params;
        const event = await prisma_1.default.event.findUnique({ where: { id }, select: { ownerId: true, name: true } });
        if (!event) {
            (0, response_1.sendError)(res, 'Event not found', 404);
            return;
        }
        if (event.ownerId !== user.id) {
            (0, response_1.sendError)(res, 'Access denied', 403);
            return;
        }
        const membership = await prisma_1.default.eventMember.findUnique({
            where: { eventId_userId: { eventId: id, userId } },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!membership) {
            (0, response_1.sendError)(res, 'Member not found in this event', 404);
            return;
        }
        await prisma_1.default.eventMember.delete({ where: { eventId_userId: { eventId: id, userId } } });
        await prisma_1.default.notification.create({
            data: {
                userId,
                title: 'Removed from Event',
                message: `You have been removed from the event "${event.name}".`,
                type: 'event',
            },
        });
        await (0, auditLog_1.createAuditLog)({
            userId: user.id, eventId: id, action: 'MEMBER_REMOVED',
            details: { memberEmail: membership.user.email, memberName: membership.user.name },
            ipAddress: req.ip,
        });
        (0, response_1.sendSuccess)(res, null, 'Team member removed');
    }
    catch (err) {
        next(err);
    }
}
// ─── List all team members (for assignment dropdown) ──────────────────────────
async function listTeamMembers(req, res, next) {
    try {
        const { search } = req.query;
        const users = await prisma_1.default.user.findMany({
            where: {
                role: 'TEAM_MEMBER',
                isActive: true,
                ...(search ? { OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ] } : {}),
            },
            select: { id: true, name: true, email: true, avatarUrl: true },
            orderBy: { name: 'asc' },
        });
        (0, response_1.sendSuccess)(res, { users });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=event.controller.js.map