"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireAdmin);
router.get('/dashboard', analytics_controller_1.getDashboardAnalytics);
router.get('/events/:id', analytics_controller_1.getEventAnalytics);
router.get('/audit-logs', analytics_controller_1.getAuditLogs);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map