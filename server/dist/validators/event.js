"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMemberSchema = exports.updateEventSchema = exports.createEventSchema = void 0;
const zod_1 = require("zod");
exports.createEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200),
    description: zod_1.z.string().max(2000).optional(),
    eventDate: zod_1.z.string().datetime({ message: 'Invalid date format' }),
    location: zod_1.z.string().max(200).optional(),
    status: zod_1.z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
});
exports.updateEventSchema = exports.createEventSchema.partial();
exports.addMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().cuid('Invalid user ID'),
});
//# sourceMappingURL=event.js.map