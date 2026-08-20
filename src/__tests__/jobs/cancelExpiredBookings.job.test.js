import { PrismaClient } from '@prisma/client';
import {
  cancelExpiredPendingBookings,
  AUTO_CANCEL_REASON,
} from '../../jobs/cancelExpiredBookings.job.js';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    booking: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  })),
}));

const prismaInstance = PrismaClient.mock.results[0].value;
const { booking: bookingMock } = prismaInstance;

afterEach(() => {
  jest.clearAllMocks();
});

describe('cancelExpiredPendingBookings', () => {
  it('cancels every PENDING booking older than 24h', async () => {
    bookingMock.findMany.mockResolvedValue([
      { id: 'b1', listing: { title: 'Loft' }, user: { email: 'a@x.com' } },
      { id: 'b2', listing: { title: 'Cabin' }, user: { email: 'b@x.com' } },
    ]);
    bookingMock.updateMany.mockResolvedValue({ count: 1 });

    const count = await cancelExpiredPendingBookings();

    expect(bookingMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
    expect(bookingMock.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancellationReason: AUTO_CANCEL_REASON,
        cancelledBy: 'system',
      },
    });
    expect(bookingMock.updateMany).toHaveBeenCalledTimes(2);
    expect(count).toBe(2);
  });

  it('does not count a booking the webhook already confirmed in the meantime', async () => {
    bookingMock.findMany.mockResolvedValue([
      { id: 'b1', listing: { title: 'Loft' }, user: { email: 'a@x.com' } },
    ]);
    // Conditional update matched 0 rows: status was no longer PENDING.
    bookingMock.updateMany.mockResolvedValue({ count: 0 });

    const count = await cancelExpiredPendingBookings();

    expect(count).toBe(0);
  });

  it('returns 0 when there are no expired pending bookings', async () => {
    bookingMock.findMany.mockResolvedValue([]);

    const count = await cancelExpiredPendingBookings();

    expect(bookingMock.updateMany).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
