"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const event_controller_1 = require("../controllers/event.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const event_1 = require("../validators/event");
const router = (0, express_1.Router)();
// All event routes require authentication
router.use(auth_1.authenticate);
// Team members search (used by admin when assigning)
router.get('/team-members', auth_1.requireAdmin, event_controller_1.listTeamMembers);
// Event CRUD
router.get('/', event_controller_1.listEvents);
router.post('/', auth_1.requireAdmin, (0, validate_1.validateBody)(event_1.createEventSchema), event_controller_1.createEvent);
router.get('/:id', event_controller_1.getEvent);
router.patch('/:id', auth_1.requireAdmin, (0, validate_1.validateBody)(event_1.updateEventSchema), event_controller_1.updateEvent);
router.delete('/:id', auth_1.requireAdmin, event_controller_1.deleteEvent);
// Members
router.get('/:id/members', auth_1.requireAdmin, event_controller_1.listMembers);
router.post('/:id/members', auth_1.requireAdmin, (0, validate_1.validateBody)(event_1.addMemberSchema), event_controller_1.addMember);
router.delete('/:id/members/:userId', auth_1.requireAdmin, event_controller_1.removeMember);
exports.default = router;
//# sourceMappingURL=event.routes.js.map