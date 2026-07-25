import { PrismaClient } from '@prisma/client';
import {
  getListings,
  getListingById,
  getUserListings,
  createListing,
  getFeaturedListings,
  toggleFavorite,
  getFavoriteListings,
  getListingBookings,
  deleteListing,
  updateListing,
} from '../../controllers/listings.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    listing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    favorite: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const {
  listing: listingMock,
  booking: bookingMock,
  favorite: favoriteMock,
} = prismaInstance;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const sampleListingRow = {
  id: 'listing-1',
  title: 'Cozy place',
  pricePerNight: 100,
  beds: 2,
  bathrooms: 1,
  propertyType: 'APARTMENT',
  images: [{ url: 'https://img/1.jpg' }],
  reviews: [{ rating: 5 }],
  city: { name: 'Rosario', province: { name: 'Santa Fe' } },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getListings', () => {
  it('returns formatted listings', async () => {
    listingMock.findMany.mockResolvedValue([sampleListingRow]);
    const req = { query: {} };
    const res = mockRes();

    await getListings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'listing-1',
        location: 'Rosario, Santa Fe',
      }),
    ]);
  });

  it('filters out listings below the minimum rating client-side', async () => {
    listingMock.findMany.mockResolvedValue([
      sampleListingRow,
      { ...sampleListingRow, id: 'listing-2', reviews: [{ rating: 1 }] },
    ]);
    const req = { query: { ratingFrom: '4' } };
    const res = mockRes();

    await getListings(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('listing-1');
  });

  it('applies query filters to the Prisma where clause', async () => {
    listingMock.findMany.mockResolvedValue([]);
    const req = {
      query: {
        propertyType: 'HOUSE',
        priceFrom: '50',
        priceTo: '200',
        amenities: 'a1,a2',
        cityId: 'city-1',
        guests: '3',
        startDate: '2027-01-01',
        endDate: '2027-01-05',
        search: 'loft',
      },
    };
    const res = mockRes();

    await getListings(req, res);

    const { where } = listingMock.findMany.mock.calls[0][0];
    expect(where.propertyType).toEqual({ equals: 'HOUSE' });
    expect(where.pricePerNight).toEqual({ gte: 50, lte: 200 });
    expect(where.cityId).toBe('city-1');
    expect(where.maxGuests).toEqual({ gte: 3 });
    expect(where.AND).toHaveLength(2);
    expect(where.bookings).toBeDefined();
    expect(where.OR).toBeDefined();
  });

  it('returns 500 on a database error', async () => {
    listingMock.findMany.mockRejectedValue(new Error('db down'));
    const req = { query: {} };
    const res = mockRes();

    await getListings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getListingById', () => {
  it('returns the listing detail with computed rating and location', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'listing-1',
      city: { name: 'Rosario', province: { name: 'Santa Fe' } },
      reviews: [{ rating: 4 }, { rating: 2 }],
      amenities: [{ amenityId: 'a1', amenity: { name: 'WiFi' } }],
    });
    const req = { params: { id: 'listing-1' } };
    const res = mockRes();

    await getListingById(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.location).toBe('Rosario, Santa Fe');
    expect(body.rating).toBe(3);
    expect(body.amenities).toEqual([{ id: 'a1', name: 'WiFi' }]);
  });

  it('returns 500 on a database error', async () => {
    listingMock.findUnique.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'listing-1' } };
    const res = mockRes();

    await getListingById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUserListings', () => {
  it('returns the listings for the authenticated user', async () => {
    listingMock.findMany.mockResolvedValue([sampleListingRow]);
    const req = { user: { email: 'host@example.com' } };
    const res = mockRes();

    await getUserListings(req, res);

    expect(listingMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userEmail: 'host@example.com' } })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on a database error', async () => {
    listingMock.findMany.mockRejectedValue(new Error('db down'));
    const req = { user: { email: 'host@example.com' } };
    const res = mockRes();

    await getUserListings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createListing', () => {
  const validBody = {
    title: 'Cozy apartment',
    description: 'desc',
    address: 'addr',
    pricePerNight: 100,
    propertyType: 'APARTMENT',
    rooms: 1,
    bathrooms: 1,
    beds: 1,
    maxGuests: 2,
    cityId: 'city-1',
    images: ['https://img/1.jpg', 'https://img/2.jpg'],
    amenities: ['amenity-1'],
  };

  it('creates a listing for valid input', async () => {
    listingMock.create.mockResolvedValue({ id: 'listing-1', ...validBody });
    const req = { body: validBody, user: { email: 'host@example.com' } };
    const res = mockRes();

    await createListing(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects invalid input', async () => {
    const req = { body: { title: '' }, user: { email: 'host@example.com' } };
    const res = mockRes();

    await createListing(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listingMock.create).not.toHaveBeenCalled();
  });

  it('returns 500 on a database error', async () => {
    listingMock.create.mockRejectedValue(new Error('db down'));
    const req = { body: validBody, user: { email: 'host@example.com' } };
    const res = mockRes();

    await createListing(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getFeaturedListings', () => {
  it('returns formatted featured listings', async () => {
    listingMock.findMany.mockResolvedValue([sampleListingRow]);
    const res = mockRes();

    await getFeaturedListings({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body[0]).not.toHaveProperty('propertyType');
  });

  it('returns 500 on a database error', async () => {
    listingMock.findMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await getFeaturedListings({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('toggleFavorite', () => {
  it('removes an existing favorite', async () => {
    favoriteMock.findUnique.mockResolvedValue({
      userEmail: 'user@example.com',
      listingId: 'l1',
    });
    favoriteMock.delete.mockResolvedValue({});

    const req = {
      user: { email: 'user@example.com' },
      body: { listingId: 'l1' },
    };
    const res = mockRes();

    await toggleFavorite(req, res);

    expect(favoriteMock.delete).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'Favorite removed',
      isFavorite: false,
    });
  });

  it('adds a new favorite', async () => {
    favoriteMock.findUnique.mockResolvedValue(null);
    favoriteMock.create.mockResolvedValue({});

    const req = {
      user: { email: 'user@example.com' },
      body: { listingId: 'l1' },
    };
    const res = mockRes();

    await toggleFavorite(req, res);

    expect(favoriteMock.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'Favorite added',
      isFavorite: true,
    });
  });

  it('returns 500 on a database error', async () => {
    favoriteMock.findUnique.mockRejectedValue(new Error('db down'));
    const req = {
      user: { email: 'user@example.com' },
      body: { listingId: 'l1' },
    };
    const res = mockRes();

    await toggleFavorite(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getFavoriteListings', () => {
  it('returns the formatted favorite listings', async () => {
    favoriteMock.findMany.mockResolvedValue([{ listing: sampleListingRow }]);
    const req = { user: { email: 'user@example.com' } };
    const res = mockRes();

    await getFavoriteListings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toHaveLength(1);
  });

  it('returns 500 on a database error', async () => {
    favoriteMock.findMany.mockRejectedValue(new Error('db down'));
    const req = { user: { email: 'user@example.com' } };
    const res = mockRes();

    await getFavoriteListings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getListingBookings', () => {
  it('returns active bookings for a listing', async () => {
    bookingMock.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    const req = { params: { id: 'listing-1' } };
    const res = mockRes();

    await getListingBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: 'booking-1' }]);
  });
});

describe('deleteListing', () => {
  it('deletes a listing owned by the requester with no active bookings', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'l1',
      userEmail: 'host@example.com',
    });
    bookingMock.findFirst.mockResolvedValue(null);
    bookingMock.deleteMany.mockResolvedValue({});
    listingMock.delete.mockResolvedValue({});

    const req = { params: { id: 'l1' }, user: { email: 'host@example.com' } };
    const res = mockRes();

    await deleteListing(req, res);

    expect(listingMock.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the listing does not exist', async () => {
    listingMock.findUnique.mockResolvedValue(null);
    const req = {
      params: { id: 'ghost' },
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await deleteListing(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects deleting a listing owned by someone else', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'l1',
      userEmail: 'other@example.com',
    });
    const req = { params: { id: 'l1' }, user: { email: 'host@example.com' } };
    const res = mockRes();

    await deleteListing(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects deleting a listing with active bookings', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'l1',
      userEmail: 'host@example.com',
    });
    bookingMock.findFirst.mockResolvedValue({ id: 'booking-1' });
    const req = { params: { id: 'l1' }, user: { email: 'host@example.com' } };
    const res = mockRes();

    await deleteListing(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listingMock.delete).not.toHaveBeenCalled();
  });

  it('returns 500 on a database error', async () => {
    listingMock.findUnique.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'l1' }, user: { email: 'host@example.com' } };
    const res = mockRes();

    await deleteListing(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateListing', () => {
  const validBody = {
    title: 'Updated title',
    description: 'desc',
    address: 'addr',
    pricePerNight: 120,
    propertyType: 'APARTMENT',
    rooms: 1,
    bathrooms: 1,
    beds: 1,
    maxGuests: 2,
    cityId: 'city-1',
    images: ['https://img/1.jpg', 'https://img/2.jpg'],
    amenities: ['amenity-1'],
  };

  it('updates a listing owned by the requester', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'l1',
      userEmail: 'host@example.com',
    });
    listingMock.update.mockResolvedValue({ id: 'l1', ...validBody });

    const req = {
      params: { id: 'l1' },
      user: { email: 'host@example.com' },
      body: validBody,
    };
    const res = mockRes();

    await updateListing(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid input', async () => {
    const req = {
      params: { id: 'l1' },
      user: { email: 'host@example.com' },
      body: { title: '' },
    };
    const res = mockRes();

    await updateListing(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(listingMock.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the listing does not exist', async () => {
    listingMock.findUnique.mockResolvedValue(null);
    const req = {
      params: { id: 'ghost' },
      user: { email: 'host@example.com' },
      body: validBody,
    };
    const res = mockRes();

    await updateListing(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects updating a listing owned by someone else', async () => {
    listingMock.findUnique.mockResolvedValue({
      id: 'l1',
      userEmail: 'other@example.com',
    });
    const req = {
      params: { id: 'l1' },
      user: { email: 'host@example.com' },
      body: validBody,
    };
    const res = mockRes();

    await updateListing(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on a database error', async () => {
    listingMock.findUnique.mockRejectedValue(new Error('db down'));
    const req = {
      params: { id: 'l1' },
      user: { email: 'host@example.com' },
      body: validBody,
    };
    const res = mockRes();

    await updateListing(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
