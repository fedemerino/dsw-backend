import { PrismaClient } from '@prisma/client';
import { MailService } from '../services/mail.service.js';

const prisma = new PrismaClient();
const mailService = new MailService();

const EXPIRY_HOURS = 24;
export const AUTO_CANCEL_REASON = 'Pago no confirmado dentro de las 24hs';

/**
 * Cancels PENDING bookings whose payment was never confirmed within
 * EXPIRY_HOURS, freeing up the dates they were provisionally blocking.
 * @returns {Promise<number>} How many bookings were cancelled
 */
export async function cancelExpiredPendingBookings() {
  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);
  const candidates = await prisma.booking.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: {
      id: true,
      listing: { select: { title: true } },
      user: { select: { email: true } },
    },
  });

  let cancelledCount = 0;
  for (const booking of candidates) {
    // Atomic conditional update: if the MercadoPago webhook confirmed this
    // booking between the findMany above and here, this is a safe no-op.
    const result = await prisma.booking.updateMany({
      where: { id: booking.id, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancellationReason: AUTO_CANCEL_REASON,
        cancelledBy: 'system',
      },
    });
    if (result.count > 0) {
      cancelledCount++;
      await mailService.sendBookingCancelledEmail(booking.user.email, {
        listingTitle: booking.listing.title,
        reason: AUTO_CANCEL_REASON,
        cancelledByRole: 'system',
      });
    }
  }
  return cancelledCount;
}
