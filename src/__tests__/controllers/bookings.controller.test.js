import { Prisma, PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../../services/mercadopago.service.js';
import {
  getUserBookingsCount,
  getUserBookings,
  cancelBooking,
  getHostBookings,
  getHostBookingStats,
  createBooking,
  updateBooking,
} from '../../controllers/bookings.controller.js';

jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    constructor(message, { code }) {
      super(message);
      this.code = code;
    }
  }
  return {
    Prisma: {
      TransactionIsolationLevel: { Serializable: 'Serializable' },
      PrismaClientKnownRequestError,
      sql: (strings, ...values) => ({ strings, values }),
      empty: '',
    },
    PrismaClient: jest.fn().mockImplementation(() => {
      const instance = {
        booking: {
          count: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
          create: jest.fn(),
          groupBy: jest.fn(),
        },
        listing: { findFirst: jest.fn() },
        user: { findUnique: jest.fn() },
        payment: { update: jest.fn() },
        $queryRaw: jest.fn(),
      };
      // `tx` inside runSerializable is this same instance, so mocking
      // e.g. bookingMock.findMany below also covers calls made via `tx`.
      // Supports both $transaction forms: callback (runSerializable) and
      // array-of-promises (cancelBooking's Booking+Payment update).
      instance.$transaction = jest.fn((arg) =>
        typeof arg === 'function' ? arg(instance) : Promise.all(arg)
      );
      return instance;
    }),
  };
});

jest.mock('../../services/mercadopago.service.js', () => ({
  MercadoPagoService: jest.fn().mockImplementation(() => ({
    createPreference: jest.fn(),
    refundPayment: jest.fn(),
  })),
}));

jest.mock('../../services/mail.service.js', () => ({
  MailService: jest.fn().mockImplementation(() => ({
    sendBookingCreatedEmail: jest.fn(),
    sendBookingCancelledEmail: jest.fn(),
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const {
  booking: bookingMock,
  listing: listingMock,
  user: userMock,
  payment: paymentMock,
  $queryRaw: queryRawMock,
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

describe('getHostBookingStats', () => {
  it('returns total revenue, status breakdown and the daily series', async () => {
    bookingMock.groupBy.mockResolvedValue([
      { status: 'CONFIRMED', _count: { _all: 3 }, _sum: { totalPrice: 300 } },
      { status: 'CANCELLED', _count: { _all: 1 }, _sum: { totalPrice: 100 } },
    ]);
    queryRawMock.mockResolvedValue([
      { date: '2027-01-10', revenue: 100, bookings: 1 },
      { date: '2027-01-12', revenue: 200, bookings: 2 },
    ]);

    const req = {
      user: { email: 'host@example.com' },
      query: {},
    };
    const res = mockRes();

    await getHostBookingStats(req, res);

    expect(bookingMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: { listing: { userEmail: 'host@example.com' } },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      totalRevenue: 300,
      bookingsByStatus: { CONFIRMED: 3, CANCELLED: 1 },
      series: [
        { date: '2027-01-10', revenue: 100, bookings: 1 },
        { date: '2027-01-12', revenue: 200, bookings: 2 },
      ],
    });
  });

  it('scopes by listingId and date range when provided', async () => {
    bookingMock.groupBy.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([]);

    const req = {
      user: { email: 'host@example.com' },
      query: {
        listingId: 'listing-1',
        startDate: '2027-01-01',
        endDate: '2027-01-31',
      },
    };
    const res = mockRes();

    await getHostBookingStats(req, res);

    expect(bookingMock.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          listing: { userEmail: 'host@example.com', id: 'listing-1' },
          createdAt: expect.objectContaining({
            gte: new Date('2027-01-01'),
            lte: new Date('2027-01-31'),
          }),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 0 revenue when there are no CONFIRMED bookings', async () => {
    bookingMock.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 1 }, _sum: { totalPrice: 50 } },
    ]);
    queryRawMock.mockResolvedValue([]);

    const req = { user: { email: 'host@example.com' }, query: {} };
    const res = mockRes();

    await getHostBookingStats(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalRevenue: 0 })
    );
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.groupBy.mockRejectedValue(new Error('db down'));
    const req = { user: { email: 'host@example.com' }, query: {} };
    const res = mockRes();

    await getHostBookingStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('cancelBooking', () => {
  it('lets the guest cancel without a reason', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'PENDING', paymentId: null },
    });
    bookingMock.update.mockResolvedValue({
      id: 'b1',
      status: 'CANCELLED',
      listing: { userEmail: 'host@example.com', title: 'Loft' },
      user: { email: 'user@example.com', fullName: 'Guest User' },
    });

    const req = {
      params: { bookingId: 'b1' },
      body: {},
      user: { email: 'user@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(bookingMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancellationReason: null,
          cancelledBy: 'user@example.com',
        }),
      })
    );
    expect(mercadoPagoInstance.refundPayment).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('lets the host cancel with a reason', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'guest@example.com',
      status: 'PENDING',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'PENDING', paymentId: null },
    });
    bookingMock.update.mockResolvedValue({
      id: 'b1',
      status: 'CANCELLED',
      listing: { userEmail: 'host@example.com', title: 'Loft' },
      user: { email: 'guest@example.com', fullName: 'Guest User' },
    });

    const req = {
      params: { bookingId: 'b1' },
      body: { reason: 'Surgió un problema con la propiedad' },
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(bookingMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cancellationReason: 'Surgió un problema con la propiedad',
          cancelledBy: 'host@example.com',
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a host cancelling without a reason', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'guest@example.com',
      status: 'PENDING',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'PENDING', paymentId: null },
    });

    const req = {
      params: { bookingId: 'b1' },
      body: {},
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.update).not.toHaveBeenCalled();
  });

  it('refunds via MercadoPago when cancelling a paid, confirmed booking', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'guest@example.com',
      status: 'CONFIRMED',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'APPROVED', paymentId: 'mp-payment-1' },
    });
    mercadoPagoInstance.refundPayment.mockResolvedValue({ id: 'refund-1' });
    bookingMock.update.mockResolvedValue({
      id: 'b1',
      status: 'CANCELLED',
      listing: { userEmail: 'host@example.com', title: 'Loft' },
      user: { email: 'guest@example.com', fullName: 'Guest User' },
    });
    paymentMock.update.mockResolvedValue({ status: 'REFUNDED' });

    const req = {
      params: { bookingId: 'b1' },
      body: { reason: 'Ya no puedo hospedar' },
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(mercadoPagoInstance.refundPayment).toHaveBeenCalledWith(
      'mp-payment-1'
    );
    expect(paymentMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'b1' },
        data: { status: 'REFUNDED' },
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 422 and does not cancel when the refund fails', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'guest@example.com',
      status: 'CONFIRMED',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'APPROVED', paymentId: 'mp-payment-1' },
    });
    mercadoPagoInstance.refundPayment.mockRejectedValue(
      new Error('MercadoPago is down')
    );

    const req = {
      params: { bookingId: 'b1' },
      body: { reason: 'Ya no puedo hospedar' },
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(bookingMock.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('logs loudly and returns 500 if the DB write fails after a successful refund', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'guest@example.com',
      status: 'CONFIRMED',
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      listing: { userEmail: 'host@example.com' },
      payment: { status: 'APPROVED', paymentId: 'mp-payment-1' },
    });
    mercadoPagoInstance.refundPayment.mockResolvedValue({ id: 'refund-1' });
    bookingMock.update.mockRejectedValue(new Error('db down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const req = {
      params: { bookingId: 'b1' },
      body: { reason: 'Ya no puedo hospedar' },
      user: { email: 'host@example.com' },
    };
    const res = mockRes();

    await cancelBooking(req, res);

    expect(mercadoPagoInstance.refundPayment).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('REFUND SUCCEEDED BUT DB UPDATE FAILED'),
      expect.any(Error)
    );
    expect(res.status).toHaveBeenCalledWith(500);

    consoleSpy.mockRestore();
  });

  it('returns 404 when the booking does not exist', async () => {
    bookingMock.findUnique.mockResolvedValue(null);
    const req = {
      params: { bookingId: 'ghost' },
      body: {},
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
      listing: { userEmail: 'yet-another@example.com' },
    });
    const req = {
      params: { bookingId: 'b1' },
      body: {},
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
      listing: { userEmail: 'host@example.com' },
    });
    const req = {
      params: { bookingId: 'b1' },
      body: {},
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
      listing: { userEmail: 'host@example.com' },
    });
    const req = {
      params: { bookingId: 'b1' },
      body: {},
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
      body: {},
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
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      pricePerNight: 100,
    });
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest User' });
    bookingMock.findMany.mockResolvedValue([{ id: 'existing' }]);
    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(bookingMock.findMany).toHaveBeenCalled();
    expect(bookingMock.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when a serialization conflict is not resolved after retries', async () => {
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      pricePerNight: 100,
    });
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest User' });
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict',
      { code: 'P2034' }
    );
    bookingMock.findMany.mockRejectedValue(serializationError);
    const res = mockRes();

    await createBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(409);
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

  it('rejects when the party size exceeds the listing’s maxGuests', async () => {
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      pricePerNight: 100,
      maxGuests: 2,
    });
    userMock.findUnique.mockResolvedValue({ fullName: 'Guest User' });
    const res = mockRes();

    await createBooking(
      { ...baseReq, body: { ...baseReq.body, guests: 5 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.findMany).not.toHaveBeenCalled();
    expect(bookingMock.create).not.toHaveBeenCalled();
  });

  it('creates the booking and returns the MercadoPago init point on success', async () => {
    bookingMock.findMany.mockResolvedValue([]);
    listingMock.findFirst.mockResolvedValue({
      id: 'listing-1',
      title: 'Cozy place',
      description: 'A nice place to stay',
      pricePerNight: 100,
      maxGuests: 4,
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

  it('returns 422 when MercadoPago fails to create the preference', async () => {
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

    expect(res.status).toHaveBeenCalledWith(422);
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

  it('rejects when the party size exceeds the listing’s maxGuests', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      listingId: 'listing-1',
      guests: 2,
      listing: { pricePerNight: 100, maxGuests: 2 },
    });
    const res = mockRes();

    await updateBooking(
      { ...baseReq, body: { ...baseReq.body, guests: 5 } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMock.findMany).not.toHaveBeenCalled();
    expect(bookingMock.update).not.toHaveBeenCalled();
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

  it('returns 409 when a serialization conflict is not resolved after retries', async () => {
    bookingMock.findUnique.mockResolvedValue({
      id: 'b1',
      userEmail: 'user@example.com',
      status: 'PENDING',
      listingId: 'listing-1',
      listing: { pricePerNight: 100 },
    });
    const serializationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict',
      { code: 'P2034' }
    );
    bookingMock.findMany.mockRejectedValue(serializationError);
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on an unexpected database error', async () => {
    bookingMock.findUnique.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await updateBooking({ ...baseReq }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
