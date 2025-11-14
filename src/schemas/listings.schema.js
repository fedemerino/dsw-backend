import { z } from 'zod';

export const listingSchema = z.object({
  title: z.string().min(1, 'Listing title is required'),
  description: z.string().min(1, 'Listing description is required'),
  address: z.string().min(1, 'Listing address is required'),
  pricePerNight: z.number().min(0, 'Listing price per night is required'),
  propertyType: z.string().min(1, 'Listing property type is required'),
  rooms: z.number().min(0, 'Listing rooms are required'),
  bathrooms: z.number().min(0, 'Listing bathrooms are required'),
  beds: z.number().min(0, 'Listing beds are required'),
  petFriendly: z.boolean().optional(),
  maxGuests: z.number().min(0, 'Listing max amount of people is required'),
  cityId: z.string().min(1, 'Listing city is required'),
  images: z.array(z.string()).min(2, 'Listing images are required'),
  amenities: z.array(z.string()).min(1, 'Listing amenities are required'),
  paymentMethods: z
    .array(z.string())
    .min(1, 'Listing payment methods are required'),
});
