import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  phoneNumber: z.string().min(7, 'Phone number is required').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z
    .string()
    .min(8, 'Confirm password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z
    .string()
    .min(8, 'Confirm password must be at least 8 characters'),
});
