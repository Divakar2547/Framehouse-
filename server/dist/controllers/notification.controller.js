"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.markNotificationRead = markNotificationRead;
exports.markAllRead = markAllRead;
const response_1 = require("../utils/response");
const prisma_1 = __importDefault(require("../config/prisma"));
async function listNotifications(req, res, next) {
    try {
        const user = req.user;
        const { unreadOnly } = req.query;
        const notifications = await prisma_1.default.notification.findMany({
            where: {
                userId: user.id,
                ...(unreadOnly === 'true' ? { isRead: false } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        const unreadCount = await prisma_1.default.notification.count({
            where: { userId: user.id, isRead: false },
        });
        (0, response_1.sendSuccess)(res, { notifications, unreadCount });
    }
    catch (err) {
        next(err);
    }
}
async function markNotificationRead(req, res, next) {
    try {
        const user = req.user;
        const { id } = req.params;
        const notification = await prisma_1.default.notification.findUnique({ where: { id } });
        if (!notification || notification.userId !== user.id) {
            (0, response_1.sendError)(res, 'Notification not found', 404);
            return;
        }
        await prisma_1.default.notification.update({ where: { id }, data: { isRead: true } });
        (0, response_1.sendSuccess)(res, null, 'Notification marked as read');
    }
    catch (err) {
        next(err);
    }
}
async function markAllRead(req, res, next) {
    try {
        const user = req.user;
        await prisma_1.default.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
        (0, response_1.sendSuccess)(res, null, 'All notifications marked as read');
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=notification.controller.js.map