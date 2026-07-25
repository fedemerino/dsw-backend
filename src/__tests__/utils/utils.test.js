import { formatListing, prepareListingPayload } from '../../utils/utils.js';

describe('formatListing', () => {
  const baseListing = {
    id: 'listing-1',
    title: 'Cozy apartment',
    pricePerNight: 100,
    beds: 2,
    bathrooms: 1,
    propertyType: 'APARTMENT',
    images: [{ url: 'https://img/1.jpg' }],
    reviews: [{ rating: 4 }, { rating: 2 }],
    city: { name: 'Rosario', province: { name: 'Santa Fe' } },
  };

  it('formats a listing with reviews and location', () => {
    const result = formatListing(baseListing);

    expect(result).toEqual({
      id: 'listing-1',
      title: 'Cozy apartment',
      location: 'Rosario, Santa Fe',
      image: 'https://img/1.jpg',
      price: 100,
      rating: 3,
      reviews: 2,
      beds: 2,
      baths: 1,
      propertyType: 'APARTMENT',
    });
  });

  it('falls back to a default image and 0 rating when there are none', () => {
    const listing = { ...baseListing, images: [], reviews: [] };
    const result = formatListing(listing);

    expect(result.image).toBe('/default-listing.jpg');
    expect(result.rating).toBe(0);
    expect(result.reviews).toBe(0);
  });

  it('marks location as Unknown when there is no city', () => {
    const listing = { ...baseListing, city: null };
    const result = formatListing(listing);

    expect(result.location).toBe('Unknown');
  });

  it('omits propertyType when includePropertyType is false', () => {
    const result = formatListing(baseListing, { includePropertyType: false });

    expect(result).not.toHaveProperty('propertyType');
  });

  it('includes the full reviews array when includeReviewsArray is true', () => {
    const result = formatListing(baseListing, { includeReviewsArray: true });

    expect(result.reviews).toEqual(baseListing.reviews);
  });
});

describe('prepareListingPayload', () => {
  const data = {
    title: 'Cozy apartment',
    description: 'A nice place',
    address: '123 Main St',
    pricePerNight: 100,
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    beds: 2,
    maxGuests: 4,
    cityId: 'city-1',
    images: ['https://img/1.jpg', 'https://img/2.jpg'],
    amenities: ['amenity-1', 'amenity-2'],
  };

  it('builds a create payload with userEmail and nested creates', () => {
    const payload = prepareListingPayload(data, 'host@example.com', false);

    expect(payload.userEmail).toBe('host@example.com');
    expect(payload.petFriendly).toBe(false);
    expect(payload.amenities.create).toEqual([
      { amenity: { connect: { id: 'amenity-1' } } },
      { amenity: { connect: { id: 'amenity-2' } } },
    ]);
    expect(payload.images.create).toEqual([
      { url: 'https://img/1.jpg' },
      { url: 'https://img/2.jpg' },
    ]);
    expect(payload.amenities.deleteMany).toBeUndefined();
  });

  it('builds an update payload that clears and recreates relations', () => {
    const payload = prepareListingPayload(data, 'host@example.com', true);

    expect(payload.userEmail).toBeUndefined();
    expect(payload.amenities.deleteMany).toEqual({});
    expect(payload.images.deleteMany).toEqual({});
    expect(payload.amenities.create).toEqual([
      { amenity: { connect: { id: 'amenity-1' } } },
      { amenity: { connect: { id: 'amenity-2' } } },
    ]);
  });

  it('respects an explicit petFriendly value', () => {
    const payload = prepareListingPayload(
      { ...data, petFriendly: true },
      'host@example.com'
    );

    expect(payload.petFriendly).toBe(true);
  });
});
