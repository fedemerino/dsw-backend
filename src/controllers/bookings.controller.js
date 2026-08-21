import { Prisma, PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../services/mercadopago.service.js';
import { MailService } from '../services/mail.service.js';
import {
  createBookingSchema,
  updateBookingSchema,
} from '../schemas/bookings.schema.js';

const prisma = new PrismaClient();
const mercadoPagoService = new MercadoPagoService();
const mailService = new MailService();

/**
 * Runs `fn` inside a Serializable Prisma transaction, retrying a few times
 * on a serialization conflict (Postgres/Prisma error code P2034) before
 * giving up. Used to close check-then-act races on booking date conflicts.
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<any>} fn
 * @param {number} retries
 */
async function runSerializable(fn, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const isSerializationConflict =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034';
      if (isSerializationConflict && attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 50 + Math.random() * 100)
        );
        continue;
      }
      throw err;
    }
  }
}

/**
 * Gets the number of total and upcoming bookings for a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const getUserBookingsCount = async (req, res) => {
  try {
    const { userEmail } = req.params;
    const isAdmin = req.user.roles?.some((r) => r.role === 'ADMIN');
    if (req.user.email !== userEmail && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const totalBookings = await prisma.booking.count({ where: { userEmail } });
    const upcomingBookings = await prisma.booking.count({
      where: { userEmail, startDate: { gt: new Date() } },
    });
    res.status(200).json({ totalBookings, upcomingBookings });
  } catch (error) {
    console.error('Get user bookings count message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Gets all bookings for a user with full details
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const getUserBookings = async (req, res) => {
  try {
    const { userEmail } = req.params;
    const isAdmin = req.user.roles?.some((r) => r.role === 'ADMIN');
    if (req.user.email !== userEmail && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        userEmail,
      },
      include: {
        listing: {
          include: {
            city: {
              include: {
                province: true,
              },
            },
            images: {
              take: 1,
            },
          },
        },
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    const formatted = bookings.map((booking) => {
      return {
        createdAt: booking.createdAt,
        startDate: booking.startDate,
        endDate: booking.endDate,
        guests: booking.guests,
        id: booking.id,
        listing: booking.listing,
        payment: booking.payment,
        status: booking.status,
        totalPrice: booking.totalPrice,
        updatedAt: booking.updatedAt,
        userEmail: booking.userEmail,
        location:
          booking.listing.city.name + ', ' + booking.listing.city.province.name,
        image: booking.listing.images[0]?.url,
      };
    });
    res.status(200).json(formatted);
  } catch (error) {
    console.error('Get user bookings message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Cancels a booking. The guest who owns it or the host of its listing can
 * cancel. If the booking was CONFIRMED and paid, this triggers a real
 * MercadoPago refund before touching the DB - a failed refund aborts the
 * cancellation entirely (never cancels without refunding).
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { email } = req.user; // Usuario autenticado

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true, payment: true },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isGuest = booking.userEmail === email;
    const isHost = booking.listing.userEmail === email;
    if (!isGuest && !isHost) {
      return res.status(403).json({
        message: 'You do not have permission to cancel this booking',
      });
    }

    const reason = req.body?.reason?.trim();
    if (isHost && !reason) {
      return res.status(400).json({
        message: 'A cancellation reason is required when the host cancels',
      });
    }

    // Check if booking can be cancelled (not already cancelled or completed)
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    // Check if booking has already started
    if (new Date(booking.startDate) < new Date()) {
      return res.status(400).json({
        message: 'Cannot cancel a booking that has already started',
      });
    }

    let refunded = false;
    if (
      booking.status === 'CONFIRMED' &&
      booking.payment?.status === 'APPROVED' &&
      booking.payment?.paymentId
    ) {
      try {
        await mercadoPagoService.refundPayment(booking.payment.paymentId);
        refunded = true;
      } catch (refundError) {
        console.error(
          'MercadoPago refund failed:',
          refundError?.message ?? refundError
        );
        if (refundError?.status)
          console.error('MercadoPago status:', refundError.status);
        if (refundError?.error)
          console.error('MercadoPago error code:', refundError.error);
        if (refundError?.causes?.length)
          console.error('MercadoPago causes:', refundError.causes);
        return res.status(422).json({
          message:
            'No se pudo procesar el reembolso. La reserva no fue cancelada.',
        });
      }
    }

    let cancelledBooking;
    try {
      [cancelledBooking] = await prisma.$transaction([
        prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CANCELLED',
            cancellationReason: reason || null,
            cancelledBy: email,
          },
          include: {
            listing: {
              include: {
                city: {
                  include: {
                    province: true,
                  },
                },
              },
            },
            payment: true,
            user: { select: { email: true, fullName: true } },
          },
        }),
        ...(refunded
          ? [
              prisma.payment.update({
                where: { bookingId },
                data: { status: 'REFUNDED' },
              }),
            ]
          : []),
      ]);
    } catch (dbError) {
      if (refunded) {
        console.error(
          `REFUND SUCCEEDED BUT DB UPDATE FAILED — bookingId=${bookingId} needs manual reconciliation`,
          dbError
        );
      }
      throw dbError;
    }

    const recipient = isHost
      ? cancelledBooking.user.email
      : cancelledBooking.listing.userEmail;
    await mailService.sendBookingCancelledEmail(recipient, {
      listingTitle: cancelledBooking.listing.title,
      reason,
      cancelledByRole: isHost ? 'host' : 'guest',
    });

    res.status(200).json({
      message: 'Booking cancelled successfully',
      booking: cancelledBooking,
    });
  } catch (error) {
    console.error('Cancel booking message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Updates a pending booking's dates/guests (owner only). Confirmed or
 * cancelled bookings cannot be modified - cancel and create a new one instead.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const updateBooking = async (req, res) => {
  try {
    const { error, data } = updateBookingSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    const { bookingId } = req.params;
    const { email } = req.user;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.userEmail !== email) {
      return res.status(403).json({
        message: 'You do not have permission to update this booking',
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        message: 'Only pending bookings can be updated',
      });
    }

    const requestedStartDate = new Date(data.startDate);
    const requestedEndDate = new Date(data.endDate);

    if (requestedStartDate >= requestedEndDate) {
      return res.status(400).json({
        message: 'End date must be after start date',
      });
    }

    const requestedGuests = data.guests || booking.guests;
    if (requestedGuests > booking.listing.maxGuests) {
      return res.status(400).json({
        message: `Este alojamiento admite hasta ${booking.listing.maxGuests} huéspedes`,
      });
    }

    const durationInDays = Math.ceil(
      (requestedEndDate - requestedStartDate) / (1000 * 60 * 60 * 24)
    );
    const totalPrice =
      Math.round(booking.listing.pricePerNight * durationInDays * 1.1 * 100) /
      100;

    let updatedBooking;
    try {
      updatedBooking = await runSerializable(async (tx) => {
        // Re-check status inside the transaction: it may have changed
        // (cancelled/confirmed) between the read above and this point.
        const freshBooking = await tx.booking.findUnique({
          where: { id: bookingId },
        });
        if (!freshBooking || freshBooking.status !== 'PENDING') {
          const statusError = new Error('Only pending bookings can be updated');
          statusError.isBookingStatusConflict = true;
          throw statusError;
        }

        const conflictingBookings = await tx.booking.findMany({
          where: {
            listingId: booking.listingId,
            id: { not: bookingId },
            AND: [
              {
                OR: [{ status: 'CONFIRMED' }, { status: 'PENDING' }],
              },
              {
                startDate: { lt: requestedEndDate },
                endDate: { gt: requestedStartDate },
              },
            ],
          },
        });

        if (conflictingBookings.length > 0) {
          const conflictError = new Error(
            'Listing not available for the given dates'
          );
          conflictError.isBookingConflict = true;
          throw conflictError;
        }

        return tx.booking.update({
          where: { id: bookingId },
          data: {
            startDate: requestedStartDate,
            endDate: requestedEndDate,
            guests: requestedGuests,
            totalPrice,
          },
          include: { listing: true, payment: true },
        });
      });
    } catch (txError) {
      if (txError.isBookingStatusConflict || txError.isBookingConflict) {
        return res.status(400).json({ message: txError.message });
      }
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2034'
      ) {
        return res.status(409).json({
          message:
            'Alguien más modificó esta reserva justo ahora. Intentá de nuevo.',
        });
      }
      throw txError;
    }

    res.status(200).json({
      message: 'Booking updated successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getHostBookings = async (req, res) => {
  try {
    const { email } = req.user;
    const bookings = await prisma.booking.findMany({
      where: {
        listing: { userEmail: email },
      },
      include: {
        listing: {
          include: {
            images: { take: 1 },
            city: { include: { province: true } },
          },
        },
        user: {
          select: {
            email: true,
            fullName: true,
            avatarUrl: true,
            phoneNumber: true,
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Get host bookings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Revenue/booking metrics for the authenticated host's own listings, scoped
 * by when the booking was made (createdAt), optionally filtered to a date
 * range and/or a single listing.
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const getHostBookingStats = async (req, res) => {
  try {
    const { email } = req.user;
    const { startDate, endDate, listingId } = req.query;
    const rangeStart = startDate ? new Date(startDate) : null;
    const rangeEnd = endDate ? new Date(endDate) : null;

    const baseWhere = {
      listing: {
        userEmail: email,
        ...(listingId && { id: listingId }),
      },
      ...(rangeStart && {
        createdAt: { gte: rangeStart, ...(rangeEnd && { lte: rangeEnd }) },
      }),
    };

    const statusGroups = await prisma.booking.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { totalPrice: true },
    });

    const totalRevenue =
      statusGroups.find((g) => g.status === 'CONFIRMED')?._sum.totalPrice ?? 0;
    const bookingsByStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all])
    );

    const series = await prisma.$queryRaw`
      SELECT date_trunc('day', b."createdAt")::date AS date,
             SUM(b."totalPrice")::float AS revenue,
             COUNT(*)::int AS bookings
      FROM "bookings" b
      JOIN "listings" l ON l.id = b."listingId"
      WHERE l."userEmail" = ${email}
        AND b.status = 'CONFIRMED'
        ${listingId ? Prisma.sql`AND b."listingId" = ${listingId}` : Prisma.empty}
        ${rangeStart ? Prisma.sql`AND b."createdAt" >= ${rangeStart}` : Prisma.empty}
        ${rangeEnd ? Prisma.sql`AND b."createdAt" <= ${rangeEnd}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;

    res.status(200).json({ totalRevenue, bookingsByStatus, series });
  } catch (error) {
    console.error('Get host booking stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createBooking = async (req, res) => {
  try {
    const { error, data } = createBookingSchema.safeParse(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }
    const { listingId, startDate, endDate, guests } = data;
    const { email } = req.user;

    // verify if the listing is available for the given dates
    const requestedStartDate = new Date(startDate);
    const requestedEndDate = new Date(endDate);

    if (requestedStartDate >= requestedEndDate) {
      return res.status(400).json({
        message: 'End date must be after start date',
      });
    }

    const [listing, user] = await Promise.all([
      prisma.listing.findFirst({ where: { id: listingId } }),
      prisma.user.findUnique({ where: { email }, select: { fullName: true } }),
    ]);
    if (!listing) {
      return res.status(400).json({ message: 'Listing not found' });
    }

    const requestedGuests = guests || 1;
    if (requestedGuests > listing.maxGuests) {
      return res.status(400).json({
        message: `Este alojamiento admite hasta ${listing.maxGuests} huéspedes`,
      });
    }

    const durationInDays = Math.ceil(
      (requestedEndDate - requestedStartDate) / (1000 * 60 * 60 * 24)
    );
    const totalPrice =
      Math.round(listing.pricePerNight * durationInDays * 1.1 * 100) / 100;

    let booking;
    try {
      booking = await runSerializable(async (tx) => {
        const conflictingBookings = await tx.booking.findMany({
          where: {
            listingId: listingId,
            AND: [
              {
                OR: [{ status: 'CONFIRMED' }, { status: 'PENDING' }],
              },
              {
                startDate: { lt: requestedEndDate },
                endDate: { gt: requestedStartDate },
              },
            ],
          },
        });

        if (conflictingBookings.length > 0) {
          const conflictError = new Error(
            'Listing not available for the given dates'
          );
          conflictError.isBookingConflict = true;
          throw conflictError;
        }

        return tx.booking.create({
          data: {
            listing: { connect: { id: listingId } },
            startDate: requestedStartDate,
            endDate: requestedEndDate,
            guests: requestedGuests,
            totalPrice,
            payment: { create: { amount: totalPrice } },
            user: { connect: { email: email } },
            status: 'PENDING',
          },
          include: { payment: true, listing: true },
        });
      });
    } catch (txError) {
      if (txError.isBookingConflict) {
        return res.status(400).json({ message: txError.message });
      }
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2034'
      ) {
        return res.status(409).json({
          message:
            'Alguien más reservó estas fechas justo ahora. Intentá de nuevo.',
        });
      }
      throw txError;
    }

    let initPoint = null;
    let preferenceId = null;

    try {
      const nameParts = (user?.fullName ?? '').trim().split(' ');
      const payerFirstName = nameParts[0] ?? '';
      const payerLastName =
        nameParts.length > 1 ? nameParts.slice(1).join(' ') : payerFirstName;

      const preference = await mercadoPagoService.createPreference({
        items: [
          {
            title: listing.title,
            description: listing.description.slice(0, 255),
            quantity: 1,
            unit_price: totalPrice,
          },
        ],
        paymentId: booking.payment.id,
        payerEmail: email,
        payerFirstName,
        payerLastName,
      });

      preferenceId = preference?.id ?? preference?.body?.id ?? null;
      initPoint =
        preference?.init_point ?? preference?.body?.init_point ?? null;

      if (preferenceId || initPoint) {
        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: {
            ...(preferenceId && { preferenceId }),
            ...(initPoint && { initPoint }),
          },
        });
      }
    } catch (mpError) {
      console.error(
        'MercadoPago createPreference failed:',
        mpError?.message ?? mpError
      );
      if (mpError?.status) console.error('MercadoPago status:', mpError.status);
      if (mpError?.error)
        console.error('MercadoPago error code:', mpError.error);
      if (mpError?.causes?.length)
        console.error('MercadoPago causes:', mpError.causes);
      return res.status(422).json({
        message:
          'Booking created but payment link could not be generated. Please try again or contact support.',
        booking,
        initPoint: null,
        preferenceId: null,
        error:
          process.env.NODE_ENV === 'development'
            ? (mpError?.message ?? String(mpError))
            : undefined,
      });
    }

    await mailService.sendBookingCreatedEmail(listing.userEmail, {
      guestName: user?.fullName ?? email,
      listingTitle: listing.title,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: booking.totalPrice,
    });

    return res.status(201).json({
      booking,
      initPoint,
      preferenceId,
    });
  } catch (error) {
    console.error('createBooking error:', error?.message ?? error);
    return res.status(500).json({
      message: 'Failed to create booking',
      ...(process.env.NODE_ENV === 'development' && {
        error: error?.message ?? String(error),
      }),
    });
  }
};
