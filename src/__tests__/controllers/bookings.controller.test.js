import { PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../../services/mercadopago.service.js';
import {
  getUserBookingsCount,
  getUserBookings,
  cancelBooking,
  getHostBookings,
  createBooking,
  updateBooking,
} from '../../controllers/bookings.controller.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    booking: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    listing: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    payment: { update: jest.fn() },
  })),
}));

jest.mock('../../services/mercadopago.service.js', () => ({
  MercadoPagoService: jest.fn().mockImplementation(() => ({
    createPreference: jest.fn(),
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const {
  booking: bookingMock,
  listing: listingMock,
  user: userMock,
  payment: paymentMock,
} = prismaInstance;
const mercadoPagoInstance = MercadoPagoService.mock.results[0].value;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('getUserBookingsCount', () => {
  it('returns counts for the user themself', async () => {
    bookingMock.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    const req = {
      params: { userEmail: 'user@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookingsCount(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      totalBookings: 5,
      upcomingBookings: 2,
    });
  });

  it('allows an admin to query another user’s counts', async () => {
    bookingMock.count.mockResolvedValue(0);
    const req = {
      params: { userEmail: 'other@example.com' },
      user: { email: 'admin@example.com', roles: [{ role: 'ADMIN' }] },
    };
    const res = mockRes();

    await getUserBookingsCount(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects querying another user’s counts without admin', async () => {
    const req = {
      params: { userEmail: 'other@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookingsCount(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.count.mockRejectedValue(new Error('db down'));
    const req = {
      params: { userEmail: 'user@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookingsCount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getUserBookings', () => {
  it('returns the formatted booking history', async () => {
    bookingMock.findMany.mockResolvedValue([
      {
        id: 'b1',
        createdAt: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        guests: 2,
        status: 'CONFIRMED',
        totalPrice: 100,
        updatedAt: new Date(),
        userEmail: 'user@example.com',
        payment: { status: 'APPROVED' },
        listing: {
          city: { name: 'Rosario', province: { name: 'Santa Fe' } },
          images: [{ url: 'https://img/1.jpg' }],
        },
      },
    ]);
    const req = {
      params: { userEmail: 'user@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body[0].location).toBe('Rosario, Santa Fe');
    expect(body[0].image).toBe('https://img/1.jpg');
  });

  it('rejects access to another user’s bookings without admin', async () => {
    const req = {
      params: { userEmail: 'other@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.findMany.mockRejectedValue(new Error('db down'));
    const req = {
      params: { userEmail: 'user@example.com' },
      user: { email: 'user@example.com', roles: [] },
    };
    const res = mockRes();

    await getUserBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getHostBookings', () => {
  it('returns bookings for the host’s listings', async () => {
    bookingMock.findMany.mockResolvedValue([{ id: 'b1' }]);
    const req = { user: { email: 'host@example.com' } };
    const res = mockRes();

    await getHostBookings(req, res);

    expect(bookingMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listing: { userEmail: 'host@example.com' } },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.findMany.mockRejectedValue(new Error('db down'));
    const req = { user: { email: 'host@example.com' } };
    const res = mockRes();

    await getHostBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('cancelBooking', () => {
  it('cancels a booking owned by the requester', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    bookingMock.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' });

    const req = {
      params: { bookingId: 'b1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the booking does not exist', async () => {
    bookingMock.findUnique.mockResolvedValue(null);
    const req = {
      params: { bookingId: 'ghost' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects cancelling someone else’s booking', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'other@example.com',
    });
    const req = {
      params: { bookingId: 'b1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects cancelling an already-cancelled booking', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'CANCELLED',
    });
    const req = {
      params: { bookingId: 'b1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects cancelling a booking that already started', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'CONFIRMED',
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
    });
    const req = {
      params: { bookingId: 'b1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.findUnique.mockRejectedValue(new Error('db down'));
    const req = {
      params: { bookingId: 'b1' },
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createBooking', () => {
  const baseReq = {
    body: {
      listingId: 'listing-1',
      startDate: '2027-01-10T00:00:00.000Z',
      endDate: '2027-01-15T00:00:00.000Z',
      guests: 2,
    },
    user: { email: 'guest@example.com' },
  };

  it('rejects when endDate is not after startDate', async () => {
    const req = {
      ...baseReq,
      body: { ...baseReq.body, startDate: '2027-01-15', endDate: '2027-01-10' },
    };
    const res = mockRes();

    await createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.findMany).not.toHaveBeenCalled();
  });

  it('rejects when there are conflicting bookings', async () => {
    bookingMock.findMany.mockResolvedValue([{ id: 'existing' }]);
    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when the listing does not exist', async () => {
    bookingMock.findMany.mockResolvedValue([]);
    listingMock.findFirst.mockResolvedValue(null);
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest' });
    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.create).not.toHaveBeenCalled();
  });

  it('creates the booking and returns the MercadoPago init point on success', async () => {
    bookingMock.findMany.mockResolvedValue([]);
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      description: 'A nice place to stay',
      pricePerNight: 100,
    });
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest User' });
    bookingMock.create.mockResolvedValue({
      id: 'booking-1',
      payment: { id: 'payment-1' },
      listing: { id: 'listing-1' },
    });
    mercadoPagoInstance.createPreference.mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp.test/pref-1',
    });
    paymentMock.update.mockResolvedValue({});

    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ initPoint: 'https://mp.test/pref-1' })
    );
  });

  it('returns 502 when MercadoPago fails to create the preference', async () => {
    bookingMock.findMany.mockResolvedValue([]);
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      description: 'A nice place to stay',
      pricePerNight: 100,
    });
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest User' });
    bookingMock.create.mockResolvedValue({
      id: 'booking-1',
      payment: { id: 'payment-1' },
      listing: { id: 'listing-1' },
    });
    mercadoPagoInstance.createPreference.mockRejectedValue(
      new Error('MP down')
    );

    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('returns 500 on an unexpected error', async () => {
    bookingMock.findMany.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateBooking', () => {
  const baseReq = {
    params: { bookingId: 'b1' },
    body: {
      startDate: '2027-02-10T00:00:00.000Z',
      endDate: '2027-02-15T00:00:00.000Z',
      guests: 3,
    },
    user: { email: 'user@example.com' },
  };

  it('updates a pending booking owned by the requester', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      listingId: 'listing-1',
      guests: 2,
      listing: { pricePerNight: 100 },
    });
    bookingMock.findMany.mockResolvedValue([]);
    bookingMock.update.mockResolvedValue({ id: 'b1', status: 'PENDING' });

    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(bookingMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ guests: 3 }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the booking does not exist', async () => {
    bookingMock.findUnique.mockResolvedValue(null);
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects updating someone else’s booking', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'other@example.com',
      status: 'PENDING',
    });
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects updating a booking that is not pending', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'CONFIRMED',
    });
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when endDate is not after startDate', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      listing: { pricePerNight: 100 },
    });
    const req = {
      ...baseReq,
      body: { startDate: '2027-02-15', endDate: '2027-02-10' },
    };
    const res = mockRes();

    await updateBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when the new dates conflict with another booking', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      listingId: 'listing-1',
      listing: { pricePerNight: 100 },
    });
    bookingMock.findMany.mockResolvedValue([{ id: 'other-booking' }]);
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.update).not.toHaveBeenCalled();
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.findUnique.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
