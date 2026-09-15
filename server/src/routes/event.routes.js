import { Router } from 'express';
import {
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  listMembers,
  addMember,
  removeMember,
  listTeamMembers,
} from '../controllers/event.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createEventSchema, updateEventSchema, addMemberSchema } from '../validators/event.js';

const router = Router();

// All event routes require authentication
router.use(authenticate);

// Team members search (used by admin when assigning)
router.get('/team-members', requireAdmin, listTeamMembers);

// Event CRUD
router.get('/', listEvents);
router.post('/', requireAdmin, validateBody(createEventSchema), createEvent);
router.get('/:id', getEvent);
router.patch('/:id', requireAdmin, validateBody(updateEventSchema), updateEvent);
router.delete('/:id', requireAdmin, deleteEvent);

// Members
router.get('/:id/members', requireAdmin, listMembers);
router.post('/:id/members', requireAdmin, validateBody(addMemberSchema), addMember);
router.delete('/:id/members/:userId', requireAdmin, removeMember);

export default router;
