import { PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../services/mercadopago.service.js';

const prisma = new PrismaClient();
const mercadoPagoService = new MercadoPagoService();

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
 * Cancels a booking
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { email } = req.user; // Usuario autenticado

    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify that the user owns this booking
    if (booking.userEmail !== email) {
      return res.status(403).json({
        message: 'You do not have permission to cancel this booking',
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

    // Update booking status to CANCELLED
    const cancelledBooking = await prisma.booking.update({
      where: {
        id: bookingId,
      },
      data: {
        status: 'CANCELLED',
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
      },
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

export const createBooking = async (req, res) => {
  try {
    const { listingId, startDate, endDate, guests } = req.body;
    const { email } = req.user;

    // verify if the listing is available for the given dates
    const requestedStartDate = new Date(startDate);
    const requestedEndDate = new Date(endDate);

    if (requestedStartDate >= requestedEndDate) {
      return res.status(400).json({
        message: 'End date must be after start date',
      });
    }

    const conflictingBookings = await prisma.booking.findMany({
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
      return res
        .status(400)
        .json({ message: 'Listing not available for the given dates' });
    }

    const [listing, user] = await Promise.all([
      prisma.listing.findFirst({ where: { id: listingId } }),
      prisma.user.findUnique({ where: { email }, select: { fullName: true } }),
    ]);
    if (!listing) {
      return res.status(400).json({ message: 'Listing not found' });
    }

    const durationInDays = Math.ceil(
      (requestedEndDate - requestedStartDate) / (1000 * 60 * 60 * 24)
    );
    const totalPrice =
      Math.round(listing.pricePerNight * durationInDays * 1.1 * 100) / 100;

    const booking = await prisma.booking.create({
      data: {
        listing: { connect: { id: listingId } },
        startDate: requestedStartDate,
        endDate: requestedEndDate,
        guests: guests || 1,
        totalPrice,
        payment: { create: { amount: totalPrice } },
        user: { connect: { email: email } },
        status: 'PENDING',
      },
      include: { payment: true, listing: true },
    });

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
      if (mpError?.cause) console.error('MercadoPago cause:', mpError.cause);
      if (mpError?.body) console.error('MercadoPago body:', mpError.body);
      return res.status(502).json({
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
