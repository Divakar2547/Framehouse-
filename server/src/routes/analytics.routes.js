import { Router } from 'express';
import { getDashboardAnalytics, getEventAnalytics, getAuditLogs } from '../controllers/analytics.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardAnalytics);
router.get('/events/:id', getEventAnalytics);
router.get('/audit-logs', getAuditLogs);

export default router;
