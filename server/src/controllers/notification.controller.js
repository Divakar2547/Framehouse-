import { sendSuccess, sendError } from '../utils/response.js';
import prisma from '../config/prisma.js';

export async function listNotifications(req, res, next) {
  try {
    const user = req.user;
    const { unreadOnly } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly === 'true' ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    sendSuccess(res, { notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      sendError(res, 'Notification not found', 404);
      return;
    }

    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const user = req.user;
    await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}
