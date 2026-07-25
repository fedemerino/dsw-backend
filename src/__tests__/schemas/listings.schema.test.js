import { listingSchema } from '../../schemas/listings.schema.js';

const validListing = {
  title: 'Cozy apartment',
  description: 'A nice place to stay',
  address: '123 Main St',
  pricePerNight: 100,
  propertyType: 'APARTMENT',
  rooms: 2,
  bathrooms: 1,
  beds: 2,
  maxGuests: 4,
  cityId: 'city-1',
  images: ['https://img/1.jpg', 'https://img/2.jpg'],
  amenities: ['amenity-1'],
};

describe('listingSchema', () => {
  it('accepts a valid listing', () => {
    expect(listingSchema.safeParse(validListing).success).toBe(true);
  });

  it('rejects a listing with a negative price', () => {
    const result = listingSchema.safeParse({
      ...validListing,
      pricePerNight: -10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a listing with less than 2 images', () => {
    const result = listingSchema.safeParse({
      ...validListing,
      images: ['https://img/1.jpg'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a listing with no amenities', () => {
    const result = listingSchema.safeParse({ ...validListing, amenities: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a listing with a missing title', () => {
    const { title: _title, ...rest } = validListing;
    const result = listingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
