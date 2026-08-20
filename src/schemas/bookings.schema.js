import { z } from 'zod';

export const createBookingSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  guests: z.number().int().min(1, 'At least 1 guest is required').optional(),
});

export const updateBookingSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  guests: z.number().int().min(1, 'At least 1 guest is required').optional(),
});
