import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  eventDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  location: z.string().max(200).optional(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'Invalid user ID'),
});
