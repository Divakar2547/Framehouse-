"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', notification_controller_1.listNotifications);
router.patch('/read-all', notification_controller_1.markAllRead);
router.patch('/:id/read', notification_controller_1.markNotificationRead);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map