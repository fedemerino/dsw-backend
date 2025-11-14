import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Gets the number of total and upcoming bookings for a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
export const getUserBookingsCount = async (req, res) => {
  try {
    const { userEmail } = req.params;
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
              take: 1, // Solo la primera imagen para optimizar
            },
          },
        },
        paymentMethod: true,
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
        paymentMethod: booking.paymentMethod,
        status: booking.status,
        totalPrice: booking.totalPrice,
        updatedAt: booking.updatedAt,
        userEmail: booking.userEmail,
        location: booking.listing.city.name + ', ' + booking.listing.city.province.name,
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

    // Find the booking
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
        paymentMethod: true,
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

export const createBooking = async (req, res) => {
  console.log(req.body);
  const { listingId, startDate, endDate, guests } = req.body;
  // for now we only have Mercado Pago as a payment method
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: {
      name: 'Mercado Pago',
    },
  });
  if (!paymentMethod) {
    return res.status(400).json({ message: 'Payment method not found' });
  }
  const { email } = req.user;

  // verify if the listing is available for the given dates
  // Convert dates to Date objects if they're strings
  const requestedStartDate = new Date(startDate);
  const requestedEndDate = new Date(endDate);

  // Validate date range
  if (requestedStartDate >= requestedEndDate) {
    return res.status(400).json({
      message: 'End date must be after start date',
    });
  }

  // Check for overlapping bookings
  // Two date ranges overlap if: existing.startDate < requested.endDate AND existing.endDate > requested.startDate
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      listingId: listingId,
      AND: [
        {
          OR: [{ status: 'CONFIRMED' }, { status: 'PENDING' }],
        },
        {
          // Check if dates overlap
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
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
    },
  });
  if (!listing) {
    return res.status(400).json({ message: 'Listing not found' });
  }
  // create the booking
  const durationInDays = Math.ceil(
    (requestedEndDate - requestedStartDate) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = listing.pricePerNight * durationInDays * 1.1;
  console.log(durationInDays);
  console.log(totalPrice);
  const booking = await prisma.booking.create({
    data: {
      listing: {
        connect: { id: listingId },
      },
      startDate,
      endDate,
      guests: guests || 1,
      totalPrice,
      paymentMethod: { connect: { id: paymentMethod.id } },
      user: { connect: { email: email } },
      status: 'CONFIRMED',
    },
  });
  res.status(201).json(booking);
};
