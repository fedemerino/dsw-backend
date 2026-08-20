import { z } from 'zod';

export const citiesQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
