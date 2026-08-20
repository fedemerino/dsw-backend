import { z } from 'zod';

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required').optional(),
  phoneNumber: z.string().min(7, 'Phone number is required').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
});
